/**
 * MCP (Model Context Protocol) Server
 * Exposes Frankly analysis to coding agents
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createAnalysisEngine } from "../../core/engine.js";
import type { FranklyConfig } from "../../core/config.js";
import { createReportFormatter } from "../../report/json.js";

const AnalyzeChangeSchema = z.object({
    task: z.string().describe("The task or change description"),
    repositoryRoot: z.string().optional().describe("Path to repository root"),
    intensity: z.enum(["lite", "full", "ultra", "off"]).optional(),
  personality: z.enum(["conservative", "senior", "witty"]).optional(),
  executedTests: z.array(z.object({
    path: z.string(),
    name: z.string(),
    status: z.enum(["PASSED", "FAILED", "SKIPPED", "NOT_RUN"]),
    duration: z.number().optional(),
  })).optional(),
});

const PlanChangeSchema = z.object({
    task: z.string().describe("The planned task"),
    repositoryRoot: z.string().optional().describe("Path to repository root"),
});

const VerifyChangeSchema = z.object({
    task: z.string().describe("The task that was completed"),
  repositoryRoot: z.string().optional().describe("Path to repository root"),
  executedTests: AnalyzeChangeSchema.shape.executedTests,
});

const MinimizeChangeSchema = z.object({
  task: z.string(),
  repositoryRoot: z.string().optional(),
});

export class FranklyMcpServer {
  private server: Server;

    constructor(private repositoryRoot: string = process.cwd()) {
    this.server = new Server(
      { name: "frankly", version: "0.1.0" },
      { capabilities: { tools: {} } },
    );

        this.setupHandlers();
    }

    private setupHandlers(): void {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "analyze_change",
                        description:
                            "Analyze a code change and provide Red Ink Review with findings and recommendations",
                        inputSchema: {
                            type: "object" as const,
                            properties: {
                                task: {
                                    type: "string",
                                    description: "The task or change description",
                                },
                                repositoryRoot: {
                                    type: "string",
                                    description: "Path to repository root (optional, uses current working directory)",
                                },
                                intensity: {
                                    type: "string",
                                    enum: ["lite", "full", "ultra", "off"],
                                    description: "Analysis intensity level",
                                },
                personality: {
                                    type: "string",
                                    enum: ["conservative", "senior", "witty"],
                  description: "Review personality style",
                },
                executedTests: {
                  type: "array",
                  description: "Tests actually run by the caller; never use this for predictions",
                  items: {
                    type: "object",
                    properties: {
                      path: { type: "string" },
                      name: { type: "string" },
                      status: { type: "string", enum: ["PASSED", "FAILED", "SKIPPED", "NOT_RUN"] },
                      duration: { type: "number" },
                    },
                    required: ["path", "name", "status"],
                  },
                },
                            },
                            required: ["task"],
                        },
                    },
                    {
                        name: "plan_change",
                        description:
                            "Plan a change and get expected scope, budget, and potential issues before implementation",
                        inputSchema: {
                            type: "object" as const,
                            properties: {
                                task: {
                                    type: "string",
                                    description: "The planned task",
                                },
                                repositoryRoot: {
                                    type: "string",
                                    description: "Path to repository root (optional)",
                                },
                            },
                            required: ["task"],
                        },
                    },
          {
            name: "minimize_change",
            description: "Return one constrained correction pass backed by the current analysis",
            inputSchema: {
              type: "object" as const,
              properties: {
                task: { type: "string", description: "The task or change description" },
                repositoryRoot: { type: "string", description: "Path to repository root (optional)" },
              },
              required: ["task"],
            },
          },
          {
            name: "verify_change",
                        description:
                            "Verify that a completed change correctly addresses the task with no excess modifications",
                        inputSchema: {
                            type: "object" as const,
                            properties: {
                                task: {
                                    type: "string",
                                    description: "The task that was completed",
                                },
                                repositoryRoot: {
                                    type: "string",
                                    description: "Path to repository root (optional)",
                                },
                            },
                            required: ["task"],
                        },
                    },
                ],
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { params } = request;
            const name = params.name;
            const args = params.arguments || {};

            try {
                const result = await this.handleToolCall(name, args);
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: result,
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    private async handleToolCall(name: string, args: unknown): Promise<string> {
        switch (name) {
            case "analyze_change": {
                const parsed = AnalyzeChangeSchema.parse(args);
                const repo = parsed.repositoryRoot || this.repositoryRoot;
                const engine = await createAnalysisEngine(repo);

                const configOverrides: Partial<FranklyConfig> = {};
                if (parsed.intensity) configOverrides.intensity = parsed.intensity;
                if (parsed.personality) configOverrides.personality = parsed.personality;

        const result = await engine.analyze(parsed.task, configOverrides, parsed.executedTests);
                const formatter = createReportFormatter();

                return formatter.formatAsTerminal(result);
            }

            case "plan_change": {
                const parsed = PlanChangeSchema.parse(args);
                const repo = parsed.repositoryRoot || this.repositoryRoot;
                const engine = await createAnalysisEngine(repo);
                const plan = await engine.plan(parsed.task);

                return `FRANKLY · PLAN CHANGE

Task: ${parsed.task}
Normalized intent: ${plan.normalizedIntent}
Keywords: ${plan.keywords.join(", ") || "none"}
Estimated files: ${plan.estimatedFiles}
Likely touched areas: ${plan.likelyTouchedAreas.join(", ") || "none"}
Reuse candidates: ${plan.reuseCandidates.join(", ") || "none"}
Confidence: ${plan.confidence}

Concerns:
${plan.concerns.length > 0 ? plan.concerns.map((item) => `- ${item}`).join("\n") : "- none"}`;
            }

      case "verify_change": {
                const parsed = VerifyChangeSchema.parse(args);
                const repo = parsed.repositoryRoot || this.repositoryRoot;
                const engine = await createAnalysisEngine(repo);
        const result = await engine.analyze(parsed.task, { action: "observe" }, parsed.executedTests);

                if (result.review.verdict === "CLEAN") {
                    return "✓ Change verified successfully";
                } else {
                    return `⚠ Verification found issues:\n${result.review.recommendation}`;
                }
            }

            case "minimize_change": {
                const parsed = MinimizeChangeSchema.parse(args);
                const engine = await createAnalysisEngine(parsed.repositoryRoot || this.repositoryRoot);
                const result = await engine.analyze(parsed.task, { action: "correct" });
                return result.review.correction?.instruction || "No correction pass is warranted by the current evidence.";
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }

    async start(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Frankly MCP Server started");
    }
}

export async function startMcpServer(repositoryRoot?: string): Promise<void> {
    const server = new FranklyMcpServer(repositoryRoot);
    await server.start();
}
