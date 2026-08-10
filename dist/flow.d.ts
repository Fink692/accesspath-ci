import { FlowDefinition } from "./types";
export declare function parseFlow(input: string, source?: string): FlowDefinition;
export declare function loadFlow(file: string): Promise<FlowDefinition>;
export declare function resolveUrl(url: string, baseUrl?: string): string;
