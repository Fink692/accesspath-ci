import { AccessPathReport } from "./types";
export declare function writeReport(report: AccessPathReport, outputDir: string): Promise<{
    jsonPath: string;
    htmlPath: string;
}>;
export declare function markdownSummary(report: AccessPathReport): string;
