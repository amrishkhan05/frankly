/**
 * Configuration types and loader for Frankly
 */

import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";

export type FranklyTrigger = "manual" | "checkpoint" | "continuous" | "ci" | "off";
export type FranklyAction = "observe" | "advise" | "correct" | "enforce";
export type FranklyIntensity = "lite" | "full" | "ultra" | "off";
export type FranklyPersonality = "conservative" | "senior" | "witty";

const ConfigSchema = z.object({
    trigger: z.enum(["manual", "checkpoint", "continuous", "ci", "off"]).default("checkpoint"),
    action: z.enum(["observe", "advise", "correct", "enforce"]).default("correct"),
    intensity: z.enum(["lite", "full", "ultra", "off"]).default("full"),
    personality: z.enum(["conservative", "senior", "witty"]).default("senior"),
    maxCorrectionPasses: z.number().int().min(0).max(5).default(1),

    analysis: z
        .object({
            minimumSufficientChange: z.boolean().default(true),
            taskAlignment: z.boolean().default(true),
            reuseFirst: z.boolean().default(true),
            scopeDrift: z.boolean().default(true),
            refactorContamination: z.boolean().default(true),
            unnecessaryAbstractions: z.boolean().default(true),
            unnecessaryDependencies: z.boolean().default(true),
            duplication: z.boolean().default(true),
            blastRadius: z.boolean().default(true),
            changeSurface: z.boolean().default(true),
            changeNecessity: z.boolean().default(true),
            reviewBurden: z.boolean().default(true),
            contractChanges: z.boolean().default(true),
            behavioralChanges: z.boolean().default(true),
            testImpact: z.boolean().default(true),
            missingRegressionTests: z.boolean().default(true),
        })
        .default({}),

    restraint: z
        .object({
            enabled: z.boolean().default(true),
            yagni: z.boolean().default(true),
            reuseExistingCodeFirst: z.boolean().default(true),
            stdlibFirst: z.boolean().default(true),
            platformNativeFirst: z.boolean().default(true),
            installedDependenciesFirst: z.boolean().default(true),
            avoidNewDependencies: z.boolean().default(true),
            avoidPrematureAbstraction: z.boolean().default(true),
            avoidUnnecessaryGeneralization: z.boolean().default(true),
            avoidUnrelatedRefactors: z.boolean().default(true),
            preferLocalChange: z.boolean().default(true),
            preferSmallestSafeDiff: z.boolean().default(true),
            preserveSafetyGuardrails: z.boolean().default(true),
        })
        .default({}),

    tests: z
        .object({
            predictAffected: z.boolean().default(true),
            distinguishPredictedAndExecuted: z.boolean().default(true),
            detectMissingRegressionCoverage: z.boolean().default(true),
            riskBasedExecution: z.boolean().default(true),
            adapters: z
                .object({
                    jest: z.boolean().default(true),
                    vitest: z.boolean().default(true),
                    nx: z.boolean().default(true),
                })
                .default({}),
        })
        .default({}),

    correction: z
        .object({
            enabled: z.boolean().default(true),
            preserveRequestedBehavior: z.boolean().default(true),
            preserveSecurity: z.boolean().default(true),
            preserveValidation: z.boolean().default(true),
            preserveAccessibility: z.boolean().default(true),
            preserveDataIntegrity: z.boolean().default(true),
            preserveErrorHandling: z.boolean().default(true),
            preserveRegressionCoverage: z.boolean().default(true),
        })
        .default({}),

    report: z
        .object({
            redInkReview: z.boolean().default(true),
            showEvidence: z.boolean().default(true),
            showConfidence: z.boolean().default(true),
            showLowConfidenceFindings: z.boolean().default(false),
            showPersonalityLine: z.boolean().default(true),
            progressiveDisclosure: z.boolean().default(true),
        })
        .default({}),

    privacy: z
        .object({
            localOnly: z.boolean().default(true),
            telemetry: z.boolean().default(false),
            externalLLMCalls: z.boolean().default(false),
            embeddings: z.boolean().default(false),
            remoteCodeUpload: z.boolean().default(false),
        })
        .default({}),
});

export type FranklyConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(raw: unknown): FranklyConfig {
    return ConfigSchema.parse(raw);
}

export function getDefaultConfig(): FranklyConfig {
    return ConfigSchema.parse({});
}

export function loadRepositoryConfig(root: string): FranklyConfig {
    const configPath = path.join(root, "frankly.config.json");
    if (!fs.existsSync(configPath)) return getDefaultConfig();
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>;
    delete raw.$schema;
    return loadConfig(raw);
}

export const INTENSITY_DESCRIPTIONS = {
    lite: "Only obvious issues: unrelated changes, duplicate code, unnecessary dependency, obvious scope drift",
    full: "Complete analysis: YAGNI, reuse, abstraction, scope, blast radius, tests, contracts, minimization",
    ultra: "Aggressively challenge: premature generalization, new helpers, abstraction, unnecessary defensive complexity, dependency additions, avoidable files/symbols, unrelated refactoring",
    off: "No analysis",
};

export const TRIGGER_DESCRIPTIONS = {
    manual: "Only run when explicitly requested",
    checkpoint: "Run automatically at meaningful task completion points",
    continuous: "Run on meaningful debounced edit batches",
    ci: "Run on committed diff / CI / PR context",
    off: "Disable Frankly",
};

export const ACTION_DESCRIPTIONS = {
    observe: "Analyze only. Never instruct the agent to change the patch.",
    advise: "Return recommendations to the coding agent.",
    correct: "Give the coding agent exactly one automatic correction/simplification opportunity.",
    enforce: "Block completion when configured policies fail.",
};
