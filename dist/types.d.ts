export type FlowAction = {
    goto: string;
} | {
    click: string;
} | {
    fill: {
        target: string;
        value: string;
    };
} | {
    press: {
        target?: string;
        key: string;
    };
} | {
    tab?: number;
} | {
    waitFor: string;
} | {
    screenshot: string;
} | {
    scan?: string;
};
export interface FlowAssertion {
    url?: string;
    visible?: string;
    focused?: string;
    text?: {
        target: string;
        contains: string;
    };
}
export interface FlowDefinition {
    name: string;
    baseUrl?: string;
    viewport?: {
        width: number;
        height: number;
    };
    timeoutMs?: number;
    steps: FlowAction[];
    assertions?: FlowAssertion[];
    scan?: {
        include?: string[];
        exclude?: string[];
        runAfterEveryStep?: boolean;
    };
}
export interface KeyboardEvidence {
    step: number;
    action: string;
    activeElement: string;
    activeRole?: string;
    activeName?: string;
    screenshot?: string;
}
export interface ScanEvidence {
    flow: string;
    route: string;
    step: number;
    screenshot?: string;
    ariaSnapshot?: string;
    keyboardPath: KeyboardEvidence[];
}
export interface AxeNode {
    any: Array<{
        id: string;
        data?: unknown;
        message: string;
        relatedNodes?: unknown[];
    }>;
    all: Array<{
        id: string;
        data?: unknown;
        message: string;
        relatedNodes?: unknown[];
    }>;
    none: Array<{
        id: string;
        data?: unknown;
        message: string;
        relatedNodes?: unknown[];
    }>;
    impact?: string | null;
    html: string;
    target: string[];
    failureSummary?: string;
}
export interface AxeViolation {
    id: string;
    impact: string | null;
    tags: string[];
    description: string;
    help: string;
    helpUrl: string;
    nodes: AxeNode[];
    route?: string;
    step?: number;
    evidence?: string;
}
export interface FlowRunResult {
    flow: string;
    status: "passed" | "failed" | "error";
    startedAt: string;
    finishedAt: string;
    violations: AxeViolation[];
    incomplete: AxeViolation[];
    passes: number;
    scans: ScanEvidence[];
    errors: string[];
}
export interface Baseline {
    formatVersion: 1;
    generatedAt: string;
    commit?: string;
    flows: Record<string, BaselineFlow>;
}
export interface BaselineFlow {
    violations: Record<string, BaselineViolation>;
}
export interface BaselineViolation {
    id: string;
    impact: string | null;
    help: string;
    helpUrl: string;
    tags: string[];
    route: string;
    nodes: string[];
}
export interface DiffFinding {
    flow: string;
    route: string;
    id: string;
    impact: string | null;
    help: string;
    helpUrl: string;
    tags: string[];
    newNodes: string[];
    nodeCount: number;
}
export interface DiffResult {
    newViolations: DiffFinding[];
    resolvedViolations: DiffFinding[];
    unchangedViolations: DiffFinding[];
    blocking: DiffFinding[];
}
export interface AccessPathReport {
    tool: "accesspath-ci";
    version: string;
    generatedAt: string;
    commit?: string;
    baselinePath?: string;
    results: FlowRunResult[];
    diff: DiffResult;
    summary: {
        flows: number;
        failedFlows: number;
        scans: number;
        violations: number;
        newViolations: number;
        blockingViolations: number;
    };
}
