#!/usr/bin/env node

/**
 * Frankly CLI
 * Command-line interface for Frankly analysis
 */

import { createAnalysisEngine } from "../../core/engine.js";
import { createReportFormatter } from "../../report/json.js";
import type { FranklyConfig } from "../../core/config.js";
import type { ExecutedTest } from "../../core/models.js";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === "help") {
        printHelp();
        return;
    }

    const command = args[0];
    const cwd = process.cwd();

    try {
        switch (command) {
            case "review": {
                await handleReview(args.slice(1), cwd);
                break;
            }

            case "plan": {
                await handlePlan(args.slice(1), cwd);
                break;
            }

            case "verify": {
                await handleVerify(args.slice(1), cwd);
                break;
            }

            case "mcp": {
                const { startMcpServer } = await import("../mcp/server.js");
                console.log("Starting MCP server...");
                await startMcpServer(cwd);
                break;
            }

            case "config": {
                await handleConfig(args.slice(1), cwd);
                break;
            }

            default:
                console.error(`Unknown command: ${command}`);
                printHelp();
                process.exit(1);
        }
    } catch (error) {
        console.error("Error:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

async function handleReview(args: string[], cwd: string): Promise<void> {
    let task = "Review current changes";

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--task" && args[i + 1]) {
            task = args[++i];
        }
    }

  const engine = await createAnalysisEngine(cwd);
  const result = await engine.analyze(task, reviewOverrides(args), args.includes("--run-tests") ? runTests(cwd) : []);

  const formatter = createReportFormatter();
  console.log(args.includes("--json") ? formatter.formatAsJson(result) : args.includes("--markdown") ? formatter.formatAsMarkdown(result) : args.includes("--ci") ? formatter.formatAsCi(result) : formatter.formatAsTerminal(result));

  if (args.includes("--ci") && result.review.verdict !== "CLEAN") {
        process.exit(1);
    }
}

async function handlePlan(args: string[], cwd: string): Promise<void> {
    let task = "Plan changes";

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--task" && args[i + 1]) {
            task = args[++i];
        }
    }

    const engine = await createAnalysisEngine(cwd);
    const plan = await engine.plan(task);

    console.log(`FRANKLY · PLAN

Task: ${task}
Normalized intent: ${plan.normalizedIntent}
Keywords: ${plan.keywords.join(", ") || "none"}
Estimated files: ${plan.estimatedFiles}
Likely touched areas: ${plan.likelyTouchedAreas.length > 0 ? plan.likelyTouchedAreas.join(", ") : "none"}
Reuse candidates: ${plan.reuseCandidates.join(", ") || "none"}
Confidence: ${plan.confidence}

Concerns:
${plan.concerns.length > 0 ? plan.concerns.map((item) => `- ${item}`).join("\n") : "- none"}
  `);
}

async function handleVerify(args: string[], cwd: string): Promise<void> {
    let task = "Verify changes";

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--task" && args[i + 1]) {
            task = args[++i];
        }
    }

  const engine = await createAnalysisEngine(cwd);
  const result = await engine.analyze(task, reviewOverrides(args), args.includes("--run-tests") ? runTests(cwd) : []);

    const formatter = createReportFormatter();

    if (result.review.verdict === "CLEAN") {
        console.log("✓ Verification passed");
        console.log(formatter.formatAsSummary(result));
    } else {
        console.log("✗ Verification failed");
        console.log(formatter.formatAsTerminal(result));
        process.exit(1);
    }
}

function runTests(cwd: string): ExecutedTest[] {
  const command = fs.existsSync(path.join(cwd, "pnpm-lock.yaml")) ? "pnpm" : fs.existsSync(path.join(cwd, "yarn.lock")) ? "yarn" : "npm";
  const args = ["test"];
  const started = Date.now();
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: "inherit" });
  return [{ path: cwd, name: "project test command", status: result.status === 0 ? "PASSED" : "FAILED", duration: Date.now() - started }];
}

function reviewOverrides(args: string[]): Partial<FranklyConfig> {
  const intensity = args[args.indexOf("--intensity") + 1] as FranklyConfig["intensity"] | undefined;
  const personality = args[args.indexOf("--personality") + 1] as FranklyConfig["personality"] | undefined;
  return {
    ...(args.includes("--intensity") && intensity ? { intensity } : {}),
    ...(args.includes("--personality") && personality ? { personality } : {}),
  };
}

async function handleConfig(args: string[], cwd: string): Promise<void> {
    if (args.length === 0 || args[0] === "show") {
        console.log(`Frankly configuration for ${cwd}`);
        console.log(
            `
Default configuration:
  trigger: checkpoint
  action: correct
  intensity: full
  personality: senior
  maxCorrectionPasses: 1

Configuration file: frankly.config.json
      `,
        );
    } else {
        console.error("Unknown config subcommand");
    }
}

function printHelp(): void {
    console.log(`
Frankly - Change Intelligence for AI Coding Agents

Usage:
  frankly <command> [options]

Commands:
  review              Analyze current changes and produce Red Ink Review
  plan                Plan a change and estimate scope
  verify              Verify that a change is complete and correct
  mcp                 Start MCP server for agent integration
  config              Show or manage configuration
  help                Show this help message

Options:
  --task <text>       Task description
  --intensity <level> Analysis intensity: lite, full, ultra, off
  --personality       Review personality: conservative, senior, witty
  --run-tests         Execute the repository test script and record the result
  --json|--markdown   Select an output format
  --ci                Emit compact CI JSON and fail on non-clean verdict

Examples:
  frankly review --task "Fix HTTP 429 retry"
  frankly verify --task "Add retry logic"
  frankly mcp

Documentation: https://github.com/amrishkhan05/frankly
  `);
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
