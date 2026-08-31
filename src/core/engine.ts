import * as path from "node:path";
import type { FranklyConfig } from "./config.js";
import { loadConfig, loadRepositoryConfig } from "./config.js";
import type { AnalysisResult, ChangedFile, ChangedSymbol, ExecutedTest, TaskPlan } from "./models.js";
import { countDiffLines, Repository } from "../git/repository.js";
import { ProjectDetector } from "../project/detector.js";
import { SymbolExtractor } from "../graph/symbols.js";
import { ChangeAnalyzer } from "../analysis/change-classifier.js";
import { inspectRepository } from "../analysis/repository-intelligence.js";
import { RedInkReviewBuilder } from "../review/red-ink-review.js";

export interface AnalysisEngine {
  analyze(task: string, configOverrides?: Partial<FranklyConfig>, executedTests?: ExecutedTest[]): Promise<AnalysisResult>;
  plan(task: string): Promise<TaskPlan>;
}

export class FranklyAnalysisEngine implements AnalysisEngine {
  constructor(
    private readonly repository: Repository,
    private readonly projectDetector: ProjectDetector,
    private readonly symbolExtractor: SymbolExtractor,
    private readonly config: FranklyConfig,
  ) {}

  async plan(task: string): Promise<TaskPlan> {
    const analyzer = new ChangeAnalyzer();
    const keywords = analyzer.extractTaskKeywords(task);
    const diff = await this.repository.getWorkingTreeDiff();
    const intelligence = inspectRepository(this.repository.getRootPath(), keywords, [], []);
    const project = await this.projectDetector.detectProject();
    const expected = Math.max(1, Math.min(6, Math.ceil(Math.max(1, keywords.length) / 2)));
    return {
      task,
      normalizedIntent: analyzer.normalizeTaskIntent(task),
      keywords,
      estimatedFiles: expected,
      expectedSymbols: [1, Math.max(2, expected * 2)],
      expectedTests: /fix|bug|retry|behavior|feature/i.test(task) ? 1 : 0,
      expectsDependency: /dependency|package|library|sdk/i.test(task),
      expectsPublicContract: /api|public|export|contract|interface/i.test(task),
      likelyTouchedAreas: intelligence.reuseCandidates.slice(0, 5),
      reuseCandidates: intelligence.reuseCandidates,
      confidence: keywords.length > 1 ? "medium" : "low",
      concerns: [
        ...(project.isWorkspace ? ["Confirm the change stays inside the affected workspace package."] : []),
        ...(keywords.length === 0 ? ["Task text is too vague for reliable intent matching."] : []),
      ],
    };
  }

  async analyze(
    task: string,
    configOverrides?: Partial<FranklyConfig>,
    executedTests: ExecutedTest[] = [],
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const config = loadConfig({ ...this.config, ...configOverrides });
    const fileDiffs = await this.repository.getWorkingTreeDiff();
    const analyzer = new ChangeAnalyzer();
    const symbolMap = new Map<string, ReturnType<SymbolExtractor["extractSymbols"]>>();
    const degradedFindings = [];

    for (const file of fileDiffs) {
      if (file.status === "deleted" || !/\.[cm]?[jt]sx?$/.test(file.path)) continue;
      try {
        symbolMap.set(file.path, this.symbolExtractor.extractSymbols(path.join(this.repository.getRootPath(), file.path)));
      } catch (error) {
        symbolMap.set(file.path, []);
        degradedFindings.push({
          id: `semantic-fallback-${file.path}`,
          severity: "warning" as const,
          confidence: "high" as const,
          title: "Semantic analysis unavailable",
          description: `Semantic analysis unavailable for ${file.path}; using reduced-confidence diff evidence.`,
          affectedSymbols: [file.path],
          evidence: [],
        });
      }
    }

    const classifications = analyzer.classifyChanges({ task, files: fileDiffs, symbols: symbolMap });
    const symbols = classifications
      .map((item) => item.symbol)
      .filter((item): item is ChangedSymbol => "filePath" in item);
    const files: ChangedFile[] = fileDiffs.map((file) => ({
      path: file.path,
      changeType: file.status,
      ...countDiffLines(file),
      changes: file.hunks.length,
      symbols: symbols.filter((symbol) => symbol.filePath === file.path),
    }));
    const intelligence = inspectRepository(
      this.repository.getRootPath(),
      analyzer.extractTaskKeywords(task),
      fileDiffs,
      symbols,
      executedTests,
    );
    for (const symbol of symbols) {
      symbol.callers = intelligence.directCallers.filter((file) => file !== symbol.filePath);
      symbol.relatedTests = intelligence.predictedTests.filter((test) => test.path.includes(path.basename(symbol.filePath).replace(/\.[^.]+$/, ""))).map((test) => test.path);
    }

    const review = new RedInkReviewBuilder().build({
      task,
      files,
      classifications,
      scopeDrift: analyzer.detectScopeDrift(classifications.filter((item) => !("filePath" in item.symbol)), files.length),
      fileCount: files.length,
      symbolCount: symbols.length,
      intelligence,
      executedTests,
      personality: config.personality,
      action: config.action,
      intensity: config.intensity,
      disabled: config.trigger === "off" || config.intensity === "off",
      maxCorrectionPasses: config.maxCorrectionPasses,
    });
    if (config.trigger !== "off" && config.intensity !== "off") review.findings.push(...degradedFindings);

    return {
      schemaVersion: "1",
      repository: this.repository.getRootPath(),
      task,
      files,
      symbols,
      classifications,
      findings: review.findings,
      review,
      timestamp: Date.now(),
      duration: Date.now() - startTime,
    };
  }
}

export async function createAnalysisEngine(repositoryPath: string): Promise<FranklyAnalysisEngine> {
  return new FranklyAnalysisEngine(
    new Repository(repositoryPath),
    new ProjectDetector(repositoryPath),
    new SymbolExtractor(repositoryPath),
    loadRepositoryConfig(repositoryPath),
  );
}
