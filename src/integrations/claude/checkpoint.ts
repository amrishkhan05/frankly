import { readFileSync } from "node:fs";
import { loadRepositoryConfig } from "../../core/config.js";
import { createAnalysisEngine } from "../../core/engine.js";

interface StopHookInput {
    cwd?: string;
    last_assistant_message?: string;
    stop_hook_active?: boolean;
}

async function main(): Promise<void> {
    const input = JSON.parse(readFileSync(0, "utf8")) as StopHookInput;
    if (input.stop_hook_active) return;

    const root = input.cwd || process.cwd();
    const config = loadRepositoryConfig(root);
    if (config.trigger !== "checkpoint" || config.intensity === "off") return;

    const task = input.last_assistant_message || "Review current changes";
    const result = await (await createAnalysisEngine(root)).analyze(task);
    if (result.review.verdict === "CLEAN") return;

    const findings = result.review.findings
        .slice(0, 5)
        .map((finding) => `- ${finding.title}: ${finding.description}`)
        .join("\n");
    const message = `Frankly Red Ink Review\n${result.review.recommendation}\n${findings}`;
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: "Stop",
            additionalContext: message,
        },
    }));
}

main().catch((error) => {
    process.stdout.write(JSON.stringify({
        systemMessage: `Frankly checkpoint skipped: ${error instanceof Error ? error.message : String(error)}`,
    }));
});