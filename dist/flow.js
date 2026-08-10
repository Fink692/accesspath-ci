"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFlow = parseFlow;
exports.loadFlow = loadFlow;
exports.resolveUrl = resolveUrl;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const yaml_1 = __importDefault(require("yaml"));
function assertAction(action, index) {
    if (!action || typeof action !== "object" || Array.isArray(action)) {
        throw new Error(`steps[${index}] must be an action object`);
    }
    const keys = Object.keys(action);
    if (keys.length !== 1) {
        throw new Error(`steps[${index}] must contain exactly one action`);
    }
    const key = keys[0];
    if (!["goto", "click", "fill", "press", "tab", "waitFor", "screenshot", "scan"].includes(key)) {
        throw new Error(`steps[${index}] uses unsupported action '${key}'`);
    }
}
function parseFlow(input, source = "flow.yml") {
    const value = yaml_1.default.parse(input);
    if (!value || typeof value !== "object")
        throw new Error(`${source} must contain a YAML object`);
    if (typeof value.name !== "string" || !value.name.trim())
        throw new Error(`${source} requires a name`);
    if (!Array.isArray(value.steps) || value.steps.length === 0)
        throw new Error(`${source} requires at least one step`);
    value.steps.forEach(assertAction);
    for (const [index, action] of value.steps.entries()) {
        if ("goto" in action && typeof action.goto !== "string")
            throw new Error(`steps[${index}].goto must be a string`);
        if ("click" in action && typeof action.click !== "string")
            throw new Error(`steps[${index}].click must be a selector`);
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
async function loadFlow(file) {
    const path = (0, node_path_1.resolve)(file);
    return parseFlow(await (0, promises_1.readFile)(path, "utf8"), path);
}
function resolveUrl(url, baseUrl) {
    if (!baseUrl)
        return url;
    return new URL(url, baseUrl).toString();
}
//# sourceMappingURL=flow.js.map