import { access, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Baseline, BaselineFlow, BaselineViolation, DiffFinding, DiffResult, FlowRunResult } from "./types";

const severity = new Map([["critical", 4], ["serious", 3], ["moderate", 2], ["minor", 1], [null, 0]]);

export function violationKey(route: string, id: string): string {
  return `${route}::${id}`;
}

export function nodeKey(target: string[]): string {
  return target.join(" | ");
}

export function baselineFromResults(results: FlowRunResult[], commit?: string): Baseline {
  const flows: Record<string, BaselineFlow> = {};
  for (const result of results) {
    const flow = flows[result.flow] ?? { violations: {} };
    for (const violation of result.violations) {
      const route = violation.route ?? result.scans.find((scan) => scan.route)?.route ?? "unknown";
      const key = violationKey(route, violation.id);
      const current = flow.violations[key];
      const nodes = violation.nodes.map((node) => nodeKey(node.target));
      flow.violations[key] = {
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        helpUrl: violation.helpUrl,
        tags: violation.tags,
        route,
        nodes: current ? [...new Set([...current.nodes, ...nodes])] : nodes,
      };
    }
    flows[result.flow] = flow;
  }
  return { formatVersion: 1, generatedAt: new Date().toISOString(), commit, flows };
}

export async function readBaseline(path: string): Promise<Baseline | null> {
  try {
    await access(path);
  } catch {
    return null;
  }
  const baseline = JSON.parse(await readFile(path, "utf8")) as Baseline;
  if (baseline.formatVersion !== 1 || !baseline.flows) throw new Error(`Unsupported baseline format in ${path}`);
  return baseline;
}

export async function writeBaseline(path: string, baseline: Baseline): Promise<void> {
  await writeFile(path, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
}

function resultRoute(result: FlowRunResult, violation: { id: string; route?: string }): string {
  const matching = result.scans.find((scan) => scan.step >= 0 && scan.route);
  return violation.route ?? matching?.route ?? "unknown";
}

function findingFromViolation(result: FlowRunResult, violation: FlowRunResult["violations"][number], newNodes: string[]): DiffFinding {
  const route = resultRoute(result, violation);
  return {
    flow: result.flow,
    route,
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    helpUrl: violation.helpUrl,
    tags: violation.tags,
    newNodes,
    nodeCount: violation.nodes.length,
  };
}

export function diffResults(results: FlowRunResult[], baseline: Baseline | null): DiffResult {
  const newViolations: DiffFinding[] = [];
  const unchangedViolations: DiffFinding[] = [];
  const currentKeys = new Set<string>();

  for (const result of results) {
    const baselineFlow = baseline?.flows[result.flow];
    for (const violation of result.violations) {
      const route = resultRoute(result, violation);
      const key = `${result.flow}::${violationKey(route, violation.id)}`;
      currentKeys.add(key);
      const previous = baselineFlow?.violations[violationKey(route, violation.id)];
      const nodes = violation.nodes.map((node) => nodeKey(node.target));
      const newNodes = previous ? nodes.filter((node) => !previous.nodes.includes(node)) : nodes;
      const finding = findingFromViolation(result, violation, newNodes);
      if (!previous || newNodes.length > 0) newViolations.push(finding);
      else unchangedViolations.push(finding);
    }
  }

  const resolvedViolations: DiffFinding[] = [];
  if (baseline) {
    for (const [flow, baselineFlow] of Object.entries(baseline.flows)) {
      for (const violation of Object.values(baselineFlow.violations)) {
        const key = `${flow}::${violationKey(violation.route, violation.id)}`;
        if (!currentKeys.has(key)) {
          resolvedViolations.push({ flow, route: violation.route, id: violation.id, impact: violation.impact, help: violation.help, helpUrl: violation.helpUrl, tags: violation.tags, newNodes: [], nodeCount: violation.nodes.length });
        }
      }
    }
  }

  const blocking = newViolations.filter((finding) => (severity.get(finding.impact) ?? 0) >= 3);
  return { newViolations, resolvedViolations, unchangedViolations, blocking };
}
