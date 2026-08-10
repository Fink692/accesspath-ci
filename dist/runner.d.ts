import { FlowDefinition, FlowRunResult } from "./types";
export interface RunOptions {
    outputDir: string;
    headless?: boolean;
    baseUrl?: string;
}
export declare function runFlow(flow: FlowDefinition, options: RunOptions): Promise<FlowRunResult>;
