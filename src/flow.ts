import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import { FlowDefinition, FlowAction } from "./types";

function assertAction(action: unknown, index: number): asserts action is FlowAction {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new Error(`steps[${index}] must be an action object`);
  }
  const keys = Object.keys(action as object);
  if (keys.length !== 1) {
    throw new Error(`steps[${index}] must contain exactly one action`);
  }
  const key = keys[0];
  if (!["goto", "click", "fill", "press", "tab", "waitFor", "screenshot", "scan"].includes(key)) {
    throw new Error(`steps[${index}] uses unsupported action '${key}'`);
  }
}

export function parseFlow(input: string, source = "flow.yml"): FlowDefinition {
  const value = YAML.parse(input) as Partial<FlowDefinition> | null;
  if (!value || typeof value !== "object") throw new Error(`${source} must contain a YAML object`);
  if (typeof value.name !== "string" || !value.name.trim()) throw new Error(`${source} requires a name`);
  if (!Array.isArray(value.steps) || value.steps.length === 0) throw new Error(`${source} requires at least one step`);

  value.steps.forEach(assertAction);
  for (const [index, action] of value.steps.entries()) {
    if ("goto" in action && typeof action.goto !== "string") throw new Error(`steps[${index}].goto must be a string`);
    if ("click" in action && typeof action.click !== "string") throw new Error(`steps[${index}].click must be a selector`);
    if ("fill" in action && (!action.fill || typeof action.fill !== "object" || typeof action.fill.target !== "string" || typeof action.fill.value !== "string")) {
      throw new Error(`steps[${index}].fill must contain target and value strings`);
    }
    if ("press" in action && (!action.press || typeof action.press !== "object" || typeof action.press.key !== "string")) {
      throw new Error(`steps[${index}].press must contain a key`);
    }
    if ("tab" in action && action.tab !== undefined && (!Number.isInteger(action.tab) || action.tab < 1)) {
      throw new Error(`steps[${index}].tab must be a positive integer`);
    }
  }

  return {
    name: value.name,
    baseUrl: value.baseUrl,
    viewport: value.viewport,
    timeoutMs: value.timeoutMs,
    steps: value.steps,
    assertions: value.assertions ?? [],
    scan: value.scan ?? {},
  };
}

export async function loadFlow(file: string): Promise<FlowDefinition> {
  const path = resolve(file);
  return parseFlow(await readFile(path, "utf8"), path);
}

export function resolveUrl(url: string, baseUrl?: string): string {
  if (!baseUrl) return url;
  return new URL(url, baseUrl).toString();
}
