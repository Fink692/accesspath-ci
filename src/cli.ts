#!/usr/bin/env node
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadFlow } from "./flow";
import { baselineFromResults, diffResults, readBaseline, writeBaseline } from "./baseline";
import { writeReport, markdownSummary } from "./report";
import { AccessPathReport } from "./types";
import { runFlow } from "./runner";

function getArg(args: string[], name: string, fallback?: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
}

function hasArg(args: string[], name: string): boolean {
  return args.includes(name);
}

async function appendIfConfigured(path: string | undefined, value: string): Promise<void> {
  if (!path) return;
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, value, "utf8");
}

async function postPullRequestComment(summary: string, token?: string): Promise<void> {
  const repository = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!token || !repository || !eventPath) return;
  try {
    const event = JSON.parse(await readFile(eventPath, "utf8")) as { pull_request?: { number?: number } };
    const pullRequestNumber = event.pull_request?.number;
    if (!pullRequestNumber) return;
    const [owner, repo] = repository.split("/", 2);
    if (!owner || !repo) return;
    const api = `https://api.github.com/repos/${owner}/${repo}`;
    const headers = {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
    };
    const marker = "<!-- accesspath-ci -->";
    const body = `${marker}\n${summary}\n\nEvidence is attached to this workflow run in the \`accesspath-report\` artifact.`;
    const commentsResponse = await fetch(`${api}/issues/${pullRequestNumber}/comments?per_page=100`, { headers });
    if (!commentsResponse.ok) throw new Error(`could not list comments (${commentsResponse.status})`);
    const comments = await commentsResponse.json() as Array<{ id: number; body?: string }>;
    const existing = comments.find((comment) => comment.body?.includes(marker));
    const url = existing ? `${api}/issues/comments/${existing.id}` : `${api}/issues/${pullRequestNumber}/comments`;
    const response = await fetch(url, { method: existing ? "PATCH" : "POST", headers, body: JSON.stringify({ body }) });
    if (!response.ok) throw new Error(`could not ${existing ? "update" : "post"} comment (${response.status})`);
    console.log(`PR comment ${existing ? "updated" : "posted"}.`);
  } catch (error) {
    console.warn(`AccessPath could not update the PR comment: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main(): Promise<void> {
  let args = process.argv.slice(2);
  if (args.length === 0 && process.env.GITHUB_ACTIONS) {
    args = [
      "run",
      "--flow", process.env.INPUT_FLOW || "accesspath.yml",
      "--baseline", process.env.INPUT_BASELINE || ".accesspath/baseline.json",
      "--output", process.env.INPUT_OUTPUT || "accesspath-results",
    ];
    if (process.env.INPUT_UPDATE_BASELINE === "true") args.push("--update-baseline");
  }
  if (args[0] !== "run") {
    console.log("Usage: accesspath run --flow accesspath.yml [--output accesspath-results] [--baseline .accesspath/baseline.json] [--update-baseline]");
    return;
  }
  const flowPath = getArg(args, "--flow", "accesspath.yml")!;
  const outputDir = resolve(getArg(args, "--output", "accesspath-results")!);
  const baselinePath = getArg(args, "--baseline");
  const updateBaseline = hasArg(args, "--update-baseline");
  const headless = !hasArg(args, "--headed");
  const baseUrl = getArg(args, "--base-url");
  const flow = await loadFlow(flowPath);
  const result = await runFlow(flow, { outputDir, headless, baseUrl });
  const baseline = baselinePath ? await readBaseline(resolve(baselinePath)) : null;
  const diff = diffResults([result], baseline);
  const report: AccessPathReport = {
    tool: "accesspath-ci",
    version: "0.1.0",
    generatedAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA,
    baselinePath,
    results: [result],
    diff,
    summary: {
      flows: 1,
      failedFlows: result.status === "passed" ? 0 : 1,
      scans: result.scans.length,
      violations: result.violations.length,
      newViolations: diff.newViolations.length,
      blockingViolations: diff.blocking.length,
    },
  };
  const paths = await writeReport(report, outputDir);
  if (updateBaseline && baselinePath) await writeBaseline(resolve(baselinePath), baselineFromResults([result], process.env.GITHUB_SHA));
  const summary = markdownSummary(report);
  console.log(summary);
  console.log(`HTML report: ${paths.htmlPath}`);
  console.log(`JSON report: ${paths.jsonPath}`);
  for (const finding of diff.blocking) console.log(`::error title=New ${finding.impact} accessibility violation,file=${finding.route}::${finding.id}: ${finding.help}`);
  await appendIfConfigured(process.env.GITHUB_STEP_SUMMARY, summary);
  if (process.env.GITHUB_OUTPUT) {
    const output = [`report_path=${paths.htmlPath}`, `json_path=${paths.jsonPath}`, `new_violations=${diff.newViolations.length}`, `blocking_violations=${diff.blocking.length}`, `status=${diff.blocking.length ? "failed" : "passed"}`].join("\n") + "\n";
    await appendIfConfigured(process.env.GITHUB_OUTPUT, output);
  }
  await postPullRequestComment(summary, process.env.INPUT_TOKEN || process.env.GITHUB_TOKEN);
  if (result.status === "error" || result.errors.length > 0) process.exitCode = 1;
  if (diff.blocking.length > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, `## AccessPath CI — error\n\n\`${message.replaceAll("`", "'")}\`\n`, "utf8");
  process.exitCode = 1;
});
