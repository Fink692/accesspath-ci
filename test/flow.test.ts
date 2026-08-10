import test from "node:test";
import assert from "node:assert/strict";
import { parseFlow, resolveUrl } from "../src/flow";

test("parses a focused YAML flow and resolves relative URLs", () => {
  const flow = parseFlow(`
name: signup
baseUrl: http://localhost:3000
steps:
  - goto: /signup
  - fill:
      target: '#email'
      value: qa@example.com
  - tab: 2
  - scan: form
`);
  assert.equal(flow.name, "signup");
  assert.equal(flow.steps.length, 4);
  assert.equal(resolveUrl("/signup", flow.baseUrl), "http://localhost:3000/signup");
});

test("rejects malformed actions", () => {
  assert.throws(() => parseFlow("name: broken\nsteps:\n  - teleport: /nowhere\n"), /unsupported action/);
});
