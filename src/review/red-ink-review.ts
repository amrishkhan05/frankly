import type {
  ChangedFile,
  ExecutedTest,
  Finding,
  RedInkReview,
  Verdict,
} from "../core/models.js";
import type { ClassifiedChange } from "../analysis/change-classifier.js";
import type { RepositoryIntelligence } from "../analysis/repository-intelligence.js";
import type { FranklyAction, FranklyIntensity, FranklyPersonality } from "../core/config.js";

export interface ReviewInput {
  task: string;
  files: ChangedFile[];
  classifications: ClassifiedChange[];
  scopeDrift: number;
  fileCount: number;
  symbolCount: number;
  intelligence: RepositoryIntelligence;
  executedTests: ExecutedTest[];
  personality: FranklyPersonality;
  action: FranklyAction;
  intensity: FranklyIntensity;
  disabled: boolean;
  maxCorrectionPasses: number;
}

export class RedInkReviewBuilder {
  build(input: ReviewInput): RedInkReview {
    const confidence = input.intensity === "lite" ? ["high"] : input.intensity === "ultra" ? ["high", "medium", "low"] : ["high", "medium"];
    const findings = input.disabled ? [] : [...this.classificationFindings(input.classifications), ...input.intelligence.findings].filter((item) => confidence.includes(item.confidence));
    const hasUntestedImpact = !input.disabled && input.intelligence.predictedTests.length > 0 && input.executedTests.length === 0;
    const baseVerdict = this.verdict(findings, input.disabled ? 0 : input.scopeDrift, hasUntestedImpact);
    const verdict = input.action === "enforce" && baseVerdict !== "CLEAN" ? "BLOCK" : baseVerdict;
    const justified = input.classifications.filter((item) => ["REQUIRED", "SUPPORTING", "TEST", "GENERATED"].includes(item.classification)).length;
    const necessity = input.disabled ? 100 : input.classifications.length
      ? Math.max(0, Math.round((justified / input.classifications.length) * 100 - findings.filter((item) => item.confidence !== "low").length * 5))
      : 100;
    const passed = input.executedTests.filter((test) => test.status === "PASSED").length;
    const correction = input.action === "correct" && input.maxCorrectionPasses > 0 && verdict !== "CLEAN" ? input.intelligence.correction : undefined;

    return {
      task: input.task,
      verdict,
      taskAlignment: necessity >= 80 ? "high" : necessity >= 50 ? "medium" : "low",
      changeNecessity: necessity,
      changeSurface: surface(input.files, input.symbolCount, input.intelligence),
      scopeDrift: input.disabled ? 0 : input.scopeDrift,
      findings,
      blastRadius: {
        directCallers: input.intelligence.directCallers.length,
        transitiveCallers: input.intelligence.transitiveCallers.length,
        affectedPackages: input.intelligence.packages.length,
        callers: [...input.intelligence.directCallers, ...input.intelligence.transitiveCallers],
        packages: input.intelligence.packages,
      },
      testImpact: {
        likelyAffected: input.intelligence.predictedTests.filter((test) => test.status === "LIKELY_AFFECTED").length,
        possiblyAffected: input.intelligence.predictedTests.filter((test) => test.status === "POSSIBLY_AFFECTED").length,
        executed: input.executedTests.length,
        passed,
        predicted: input.intelligence.predictedTests,
        executedResults: input.executedTests,
      },
      contractChanges: input.intelligence.contracts,
      behavioralChanges: input.intelligence.behavioralChanges,
      reuseCandidates: input.intelligence.reuseCandidates,
      correction,
      recommendation: recommendation(verdict, findings, Boolean(correction)),
      personality: personalityLine(input.personality, verdict),
    };
  }

  private classificationFindings(classifications: ClassifiedChange[]): Finding[] {
    return classifications.flatMap((item, index): Finding[] => {
      if (!["SUSPICIOUS", "UNEXPLAINED", "REFACTOR", "INCIDENTAL"].includes(item.classification)) return [];
      const target = "path" in item.symbol ? item.symbol.path : item.symbol.id;
      return [{
        id: `classification-${index + 1}`,
        severity: item.classification === "UNEXPLAINED" ? "error" : "warning",
        confidence: item.confidence,
        title: item.classification === "REFACTOR" ? "Refactor contamination" : `${item.classification[0]}${item.classification.slice(1).toLowerCase()} change`,
        description: item.justification,
        affectedSymbols: [target],
        evidence: item.evidence,
        recommendation: "Remove the change or provide repository evidence that the task requires it.",
        autoCorrectible: true,
      }];
    });
  }

  private verdict(findings: Finding[], drift: number, untested: boolean): Verdict {
    if (findings.some((item) => item.title === "Refactor contamination")) return "SPLIT";
    if (findings.some((item) => item.severity === "error") || drift > 0.3 || findings.length > 3) return "SIMPLIFY";
    if (untested || findings.some((item) => item.title === "Missing regression coverage")) return "VERIFY";
    if (findings.length) return "REVIEW";
    return "CLEAN";
  }
}

function surface(files: ChangedFile[], symbols: number, intelligence: RepositoryIntelligence): "LOW" | "MEDIUM" | "HIGH" {
  const score = files.filter((file) => !/(?:-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file.path)).length
    + Math.ceil(symbols / 3)
    + intelligence.contracts.length * 2
    + Math.max(0, intelligence.packages.length - 1) * 3;
  return score <= 4 ? "LOW" : score <= 12 ? "MEDIUM" : "HIGH";
}

function recommendation(verdict: Verdict, findings: Finding[], correction: boolean): string {
  if (verdict === "CLEAN") return "Patch appears appropriately scoped; no red marks found.";
  if (correction) return "Give the coding agent the single correction pass below, then run verify_change.";
  if (verdict === "VERIFY") return "Run the predicted related tests and record their actual results.";
  if (verdict === "SPLIT") return "Move unrelated refactoring into a separate patch.";
  return `Review ${findings.length} evidence-backed finding(s) before approval.`;
}

function personalityLine(personality: FranklyPersonality, verdict: Verdict): string {
  if (personality === "conservative") return verdict === "CLEAN" ? "The patch appears proportionate." : "These changes may be broader than required.";
  if (personality === "witty") return verdict === "CLEAN" ? "Nothing to circle in red." : "The diff brought guests the task did not invite.";
  return verdict === "CLEAN" ? "Every changed line has a plausible reason." : "This task does not yet justify this patch.";
}

export function createRedInkReviewBuilder(): RedInkReviewBuilder {
  return new RedInkReviewBuilder();
}
