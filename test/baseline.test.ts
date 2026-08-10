import test from "node:test";
import assert from "node:assert/strict";
import { baselineFromResults, diffResults } from "../src/baseline";
import { FlowRunResult } from "../src/types";

function result(id: string, impact: string | null = "serious", target = "#email", route = "/signup"): FlowRunResult {
  return {
    flow: "signup",
    status: "failed",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:01.000Z",
    violations: [{ id, impact, route, tags: ["wcag2a"], description: "", help: `Fix ${id}`, helpUrl: `https://example.test/${id}`, nodes: [{ any: [], all: [], none: [], html: `<input id="${id}">`, target: [target] }] }],
    incomplete: [],
    passes: 1,
    scans: [{ flow: "signup", route, step: 1, keyboardPath: [] }],
    errors: [],
  };
}

test("identifies new serious violations and resolved baseline entries", () => {
  const baseline = baselineFromResults([result("label")]);
  const diff = diffResults([result("color-contrast")], baseline);
  assert.deepEqual(diff.newViolations.map((finding) => finding.id), ["color-contrast"]);
  assert.deepEqual(diff.blocking.map((finding) => finding.id), ["color-contrast"]);
  assert.deepEqual(diff.resolvedViolations.map((finding) => finding.id), ["label"]);
});

test("does not block on minor findings", () => {
  const diff = diffResults([result("link-name", "minor")], null);
  assert.equal(diff.newViolations.length, 1);
  assert.equal(diff.blocking.length, 0);
});

test("keeps the same rule separate across routes", () => {
  const baseline = baselineFromResults([result("label"), result("label", "serious", "#card", "/checkout")]);
  const diff = diffResults([result("label", "serious", "#card", "/checkout")], baseline);
  assert.equal(diff.newViolations.length, 0);
  assert.deepEqual(diff.unchangedViolations.map((finding) => finding.route), ["/checkout"]);
  assert.deepEqual(diff.resolvedViolations.map((finding) => finding.route), ["/signup"]);
});
