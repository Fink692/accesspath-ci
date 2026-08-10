import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AccessPathReport, DiffFinding } from "./types";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function findingRow(finding: DiffFinding, state: string): string {
  return `<tr><td><span class="badge ${state}">${state}</span></td><td>${escapeHtml(finding.flow)}</td><td>${escapeHtml(finding.route)}</td><td><code>${escapeHtml(finding.id)}</code></td><td>${escapeHtml(finding.impact ?? "unknown")}</td><td>${escapeHtml(finding.help)}<br><a href="${escapeHtml(finding.helpUrl)}">Learn more</a></td><td>${finding.newNodes.map(escapeHtml).join("<br>") || "—"}</td></tr>`;
}

export async function writeReport(report: AccessPathReport, outputDir: string): Promise<{ jsonPath: string; htmlPath: string }> {
  await mkdir(outputDir, { recursive: true });
  const jsonPath = join(outputDir, "report.json");
  const htmlPath = join(outputDir, "report.html");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const rows = [
    ...report.diff.newViolations.map((finding) => findingRow(finding, "new")),
    ...report.diff.resolvedViolations.map((finding) => findingRow(finding, "resolved")),
    ...report.diff.unchangedViolations.map((finding) => findingRow(finding, "baseline")),
  ].join("\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AccessPath CI report</title><style>
    :root{color-scheme:light dark}body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f6f7f9;color:#1f2937}main{max-width:1280px;margin:0 auto;padding:40px 24px}.hero{background:#111827;color:white;border-radius:16px;padding:28px 32px}.hero h1{margin:0 0 6px}.cards{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.card{background:white;border:1px solid #e5e7eb;border-radius:12px;padding:14px 18px;min-width:130px}.number{font-size:26px;font-weight:700}.label{color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em}table{border-collapse:collapse;background:white;width:100%;border-radius:12px;overflow:hidden}th,td{text-align:left;padding:12px;border-bottom:1px solid #e5e7eb;vertical-align:top}th{font-size:12px;text-transform:uppercase;color:#6b7280;background:#f9fafb}.badge{border-radius:999px;padding:3px 8px;font-size:12px;font-weight:600}.new{background:#fee2e2;color:#991b1b}.resolved{background:#dcfce7;color:#166534}.baseline{background:#e5e7eb;color:#374151}code{font-family:ui-monospace,monospace}a{color:#2563eb}@media(prefers-color-scheme:dark){body{background:#111827;color:#f9fafb}.card,table{background:#1f2937;border-color:#374151}th{background:#111827;color:#9ca3af}td,th{border-color:#374151}}
  </style></head><body><main><section class="hero"><h1>AccessPath CI</h1><div>Evidence-backed accessibility regression report</div></section><section class="cards"><div class="card"><div class="number">${report.summary.flows}</div><div class="label">Flows</div></div><div class="card"><div class="number">${report.summary.scans}</div><div class="label">Scans</div></div><div class="card"><div class="number">${report.summary.violations}</div><div class="label">Violations</div></div><div class="card"><div class="number">${report.summary.newViolations}</div><div class="label">New</div></div><div class="card"><div class="number">${report.summary.blockingViolations}</div><div class="label">Blocking</div></div></section><h2>Findings</h2><table><thead><tr><th>Status</th><th>Flow</th><th>Route</th><th>Rule</th><th>Impact</th><th>Guidance</th><th>New targets</th></tr></thead><tbody>${rows || '<tr><td colspan="7">No axe findings.</td></tr>'}</tbody></table></main></body></html>`;
  await writeFile(htmlPath, html, "utf8");
  return { jsonPath, htmlPath };
}

export function markdownSummary(report: AccessPathReport): string {
  const status = report.summary.blockingViolations > 0 ? "❌ blocked" : "✅ passed";
  const lines = [
    `## AccessPath CI — ${status}`,
    "",
    `- Flows: **${report.summary.flows}** · scans: **${report.summary.scans}** · total violations: **${report.summary.violations}**`,
    `- New violations: **${report.summary.newViolations}** · blocking (critical/serious): **${report.summary.blockingViolations}**`,
    "",
  ];
  for (const finding of report.diff.blocking) lines.push(`- **${finding.impact}** \`${finding.id}\` in \`${finding.flow}\` at \`${finding.route}\`: ${finding.help}`);
  if (report.diff.blocking.length === 0) lines.push("No new critical or serious accessibility violations.");
  return `${lines.join("\n")}\n`;
}
