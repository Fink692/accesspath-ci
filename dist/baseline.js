"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.violationKey = violationKey;
exports.nodeKey = nodeKey;
exports.baselineFromResults = baselineFromResults;
exports.readBaseline = readBaseline;
exports.writeBaseline = writeBaseline;
exports.diffResults = diffResults;
const promises_1 = require("node:fs/promises");
const severity = new Map([["critical", 4], ["serious", 3], ["moderate", 2], ["minor", 1], [null, 0]]);
function violationKey(route, id) {
    return `${route}::${id}`;
}
function nodeKey(target) {
    return target.join(" | ");
}
function baselineFromResults(results, commit) {
    const flows = {};
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
async function readBaseline(path) {
    try {
        await (0, promises_1.access)(path);
    }
    catch {
        return null;
    }
    const baseline = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    if (baseline.formatVersion !== 1 || !baseline.flows)
        throw new Error(`Unsupported baseline format in ${path}`);
    return baseline;
}
async function writeBaseline(path, baseline) {
    await (0, promises_1.writeFile)(path, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
}
function resultRoute(result, violation) {
    const matching = result.scans.find((scan) => scan.step >= 0 && scan.route);
    return violation.route ?? matching?.route ?? "unknown";
}
function findingFromViolation(result, violation, newNodes) {
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
function diffResults(results, baseline) {
    const newViolations = [];
    const unchangedViolations = [];
    const currentKeys = new Set();
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
            if (!previous || newNodes.length > 0)
                newViolations.push(finding);
            else
                unchangedViolations.push(finding);
        }
    }
    const resolvedViolations = [];
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
//# sourceMappingURL=baseline.js.map