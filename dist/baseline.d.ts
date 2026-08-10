import { Baseline, DiffResult, FlowRunResult } from "./types";
export declare function violationKey(route: string, id: string): string;
export declare function nodeKey(target: string[]): string;
export declare function baselineFromResults(results: FlowRunResult[], commit?: string): Baseline;
export declare function readBaseline(path: string): Promise<Baseline | null>;
export declare function writeBaseline(path: string, baseline: Baseline): Promise<void>;
export declare function diffResults(results: FlowRunResult[], baseline: Baseline | null): DiffResult;
