"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFlow = runFlow;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const playwright_1 = require("playwright");
const playwright_2 = __importDefault(require("@axe-core/playwright"));
const flow_1 = require("./flow");
function routeOf(page) {
    try {
        return new URL(page.url()).pathname || "/";
    }
    catch {
        return page.url();
    }
}
async function activeElementEvidence(page) {
    return page.evaluate(() => {
        const element = document.activeElement;
        if (!element)
            return { activeElement: "none" };
        const node = element;
        return {
            activeElement: node.outerHTML.slice(0, 500),
            activeRole: node.getAttribute("role") ?? node.tagName.toLowerCase(),
            activeName: node.getAttribute("aria-label") ?? node.getAttribute("name") ?? node.textContent?.trim().slice(0, 100) ?? undefined,
        };
    });
}
async function ariaSnapshot(page) {
    const body = page.locator("body");
    if (typeof body.ariaSnapshot !== "function")
        return undefined;
    try {
        return await body.ariaSnapshot();
    }
    catch {
        return undefined;
    }
}
async function scan(page, flow, flowName, step, outputDir, keyboardPath) {
    const builder = new playwright_2.default({ page });
    if (flow.scan?.include?.length)
        builder.include(flow.scan.include);
    if (flow.scan?.exclude?.length)
        builder.exclude(flow.scan.exclude);
    const axe = await builder.analyze();
    const route = routeOf(page);
    const screenshotName = `${String(step).padStart(2, "0")}-${routeOf(page).replace(/[^a-z0-9]+/gi, "-") || "root"}.png`;
    const screenshotPath = (0, node_path_1.join)(outputDir, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return {
        violations: axe.violations.map((violation) => ({ ...violation, route, step, evidence: screenshotName })),
        incomplete: axe.incomplete.map((violation) => ({ ...violation, route, step, evidence: screenshotName })),
        passes: axe.passes.length,
        evidence: {
            flow: flowName,
            route,
            step,
            screenshot: screenshotName,
            ariaSnapshot: await ariaSnapshot(page),
            keyboardPath: [...keyboardPath],
        },
    };
}
async function runAction(page, action, flow, step, options, keyboardPath) {
    if ("goto" in action)
        await page.goto((0, flow_1.resolveUrl)(action.goto, options.baseUrl ?? flow.baseUrl), { waitUntil: "networkidle" });
    if ("click" in action)
        await page.locator(action.click).click();
    if ("fill" in action)
        await page.locator(action.fill.target).fill(action.fill.value);
    if ("press" in action) {
        const target = action.press.target ? page.locator(action.press.target) : page.locator("body");
        await target.press(action.press.key);
    }
    if ("tab" in action) {
        const count = action.tab ?? 1;
        for (let i = 0; i < count; i++) {
            await page.keyboard.press("Tab");
            const active = await activeElementEvidence(page);
            keyboardPath.push({ step, action: "Tab", ...active });
        }
    }
    if ("waitFor" in action)
        await page.locator(action.waitFor).waitFor({ state: "visible" });
    if ("screenshot" in action)
        await page.screenshot({ path: (0, node_path_1.join)(options.outputDir, action.screenshot), fullPage: true });
    const requestedScan = "scan" in action;
    if (requestedScan || flow.scan?.runAfterEveryStep)
        return { scan: await scan(page, flow, flow.name, step, options.outputDir, keyboardPath) };
    return {};
}
async function assertFlow(page, flow) {
    for (const assertion of flow.assertions ?? []) {
        if (assertion.url && !new URL(page.url()).pathname.match(assertion.url))
            throw new Error(`Expected URL ${assertion.url}, got ${page.url()}`);
        if (assertion.visible)
            await page.locator(assertion.visible).waitFor({ state: "visible" });
        if (assertion.focused) {
            const focused = await page.locator(assertion.focused).evaluate((element) => element === document.activeElement);
            if (!focused)
                throw new Error(`Expected ${assertion.focused} to be focused`);
        }
        if (assertion.text) {
            const content = await page.locator(assertion.text.target).textContent();
            if (!content?.includes(assertion.text.contains))
                throw new Error(`Expected ${assertion.text.target} to contain '${assertion.text.contains}'`);
        }
    }
}
async function runFlow(flow, options) {
    await (0, promises_1.mkdir)(options.outputDir, { recursive: true });
    const startedAt = new Date().toISOString();
    const scans = [];
    const violations = [];
    const incomplete = [];
    const errors = [];
    const keyboardPath = [];
    let passes = 0;
    const browser = await playwright_1.chromium.launch({ headless: options.headless ?? true });
    const context = await browser.newContext({ viewport: flow.viewport ?? { width: 1440, height: 900 } });
    context.setDefaultTimeout(flow.timeoutMs ?? 15000);
    const page = await context.newPage();
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    try {
        for (const [index, action] of flow.steps.entries()) {
            const outcome = await runAction(page, action, flow, index + 1, options, keyboardPath);
            if (outcome.scan) {
                scans.push(outcome.scan.evidence);
                violations.push(...outcome.scan.violations);
                incomplete.push(...outcome.scan.incomplete);
                passes += outcome.scan.passes;
            }
        }
        await assertFlow(page, flow);
    }
    catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
    }
    finally {
        const tracePath = (0, node_path_1.join)(options.outputDir, `${flow.name.replace(/[^a-z0-9]+/gi, "-")}.zip`);
        await context.tracing.stop({ path: tracePath });
        await browser.close();
        await (0, promises_1.writeFile)((0, node_path_1.join)(options.outputDir, "keyboard-path.json"), `${JSON.stringify(keyboardPath, null, 2)}\n`, "utf8");
    }
    return { flow: flow.name, status: errors.length || violations.length ? "failed" : "passed", startedAt, finishedAt: new Date().toISOString(), violations, incomplete, passes, scans, errors };
}
//# sourceMappingURL=runner.js.map