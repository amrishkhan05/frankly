/**
 * Basic fixture for testing
 * Simple TypeScript project
 */

import { describe, it, expect } from "vitest";
import { FranklyAnalysisEngine, createAnalysisEngine } from "../core/engine.js";
import { Repository } from "../git/repository.js";
import { ProjectDetector } from "../project/detector.js";
import { SymbolExtractor } from "../graph/symbols.js";

describe("Frankly Phase 1 Foundation", () => {
    it("should detect a TypeScript project", async () => {
        const detector = new ProjectDetector(process.cwd());
        const project = await detector.detectProject();

        expect(project).toBeDefined();
        expect(project.type).toBe("typescript");
        expect(project.hasTsConfig).toBe(true);
    });

    it("should extract symbols from TypeScript files", () => {
        const extractor = new SymbolExtractor(process.cwd());
        const symbols = extractor.extractSymbols("./src/core/models.ts");

        expect(symbols).toBeDefined();
        expect(symbols.length).toBeGreaterThan(0);
    });

    it("should classify changes", async () => {
        const repository = new Repository(process.cwd());
        const status = repository.getStatus();

        // Should return status without errors
        expect(status).toBeDefined();
        expect(Array.isArray(status.modified)).toBe(true);
    });

    it("should plan a task using normalized intent and scope estimation", async () => {
        const engine = await createAnalysisEngine(process.cwd());
        const plan = await engine.plan("Please fix retry logic in the API client and add tests");

        expect(plan).toBeDefined();
        expect(plan.normalizedIntent).toContain("retry");
        expect(plan.keywords.length).toBeGreaterThan(0);
        expect(plan.estimatedFiles).toBeGreaterThan(0);
        expect(plan.estimatedFiles).toBeLessThanOrEqual(12);
    });

    it("should surface existing repo matches as reuse candidates", async () => {
        const engine = await createAnalysisEngine(process.cwd());
        const plan = await engine.plan("review the red ink logic and findings");

        expect(plan.reuseCandidates.length).toBeGreaterThan(0);
        expect(plan.reuseCandidates.some((candidate) => candidate.toLowerCase().includes("review") || candidate.toLowerCase().includes("analysis"))).toBe(true);
    });
});
