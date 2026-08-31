/**
 * Change analysis and classification
 * Determines necessity and classification of changed symbols
 */

import type {
    ChangedFile,
    ChangedSymbol,
    ChangeClassification,
    Evidence,
} from "../core/models.js";
import { countDiffLines, type FileDiff } from "../git/repository.js";
import type { ExtractedSymbol } from "../graph/symbols.js";

export interface ChangeAnalysisInput {
    task: string;
    files: FileDiff[];
    symbols: Map<string, ExtractedSymbol[]>;
}

export interface ClassifiedChange {
    symbol: ChangedSymbol | ChangedFile;
    classification: ChangeClassification;
    confidence: "high" | "medium" | "low";
    justification: string;
    evidence: Evidence[];
}

export class ChangeAnalyzer {
    /**
     * Classify all changes
     */
    classifyChanges(input: ChangeAnalysisInput): ClassifiedChange[] {
        const taskKeywords = this.extractTaskKeywords(input.task);
        const classifications: ClassifiedChange[] = [];

        // Classify files
        for (const file of input.files) {
            const classification = this.classifyFile(file, taskKeywords);
            classifications.push(classification);

            for (const symbol of (input.symbols.get(file.path) || []).filter((item) =>
                file.status === "added" || file.hunks.some((hunk) => rangesOverlap(item.lineRange, [hunk.newStart, hunk.newStart + Math.max(0, hunk.newLines - 1)])),
            )) {
                const changed = this.toChangedSymbol(file, symbol);
                const matched = taskKeywords.some((keyword) => changed.name.toLowerCase().includes(keyword));
                classifications.push({
                    symbol: changed,
                    classification: this.isTestFile(file.path) ? "TEST" : matched ? "REQUIRED" : "SUPPORTING",
                    confidence: matched ? "high" : "medium",
                    justification: matched ? "Changed symbol matches task intent" : "Symbol is inside a changed hunk",
                    evidence: [{
                        type: matched ? "TASK_MATCH" : "DIFF_DEPENDENT",
                        confidence: matched ? "high" : "medium",
                        explanation: matched ? `Symbol ${changed.name} matches task keywords` : `Symbol ${changed.name} overlaps a changed hunk`,
                        reference: changed.id,
                    }],
                });
            }
        }

        return classifications;
    }

    /**
     * Extract keywords from task description
     */
    public extractTaskKeywords(task: string): string[] {
        return task
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter((word) => word.length > 2 && !this.isCommonWord(word));
    }

    /**
     * Normalize a task into a compact intent string.
     */
    public normalizeTaskIntent(task: string): string {
        const keywords = this.extractTaskKeywords(task);
        return keywords.join(" ") || task.trim();
    }

    /**
     * Check if word is a common English word
     */
    private isCommonWord(word: string): boolean {
        const common = new Set([
            "the",
            "and",
            "for",
            "with",
            "that",
            "this",
            "from",
            "have",
            "will",
            "when",
            "can",
            "are",
            "all",
            "each",
            "where",
            "should",
            "add",
            "fix",
            "update",
            "change",
            "modify",
            "remove",
            "create",
        ]);
        return common.has(word);
    }

    /**
     * Classify a file change
     */
    private classifyFile(file: FileDiff, taskKeywords: string[]): ClassifiedChange {
        const evidence: Evidence[] = [];

        // Check if file matches task keywords
    const pathMatch = this.calculatePathMatchScore(`${file.path}\n${file.hunks.map((hunk) => hunk.content).join("\n")}`, taskKeywords);
    if (pathMatch > 0) {
            evidence.push({
                type: "TASK_MATCH",
                confidence: "high",
                explanation: `File path matches task keywords: ${file.path}`,
            });
        }

        // Calculate additions/deletions/changes
    const { additions, deletions } = countDiffLines(file);
        const changes = file.hunks.length;

        let classification: ChangeClassification = "UNEXPLAINED";
        let confidence: "high" | "medium" | "low" = "low";
        let justification = "File change appears unrelated to task";

        if (this.isGeneratedFile(file.path)) {
            classification = "GENERATED";
            confidence = "high";
            justification = "Generated artifact changed with the patch";
        } else if (file.status === "deleted") {
            classification = "UNEXPLAINED";
            confidence = "high";
            justification = "Deleted file - requires explanation";
        } else if (file.status === "added") {
      if (pathMatch > 0) {
                classification = "SUPPORTING";
                confidence = "high";
                justification = "New file related to task";
            } else {
                classification = "SUSPICIOUS";
                confidence = "medium";
                justification = "New file with unclear relationship to task";
            }
        } else if (file.status === "modified") {
      if (pathMatch > 0) {
                classification = "REQUIRED";
                confidence = "high";
                justification = "File directly related to task";
            } else if (this.isTestFile(file.path)) {
                classification = "TEST";
                confidence = "medium";
                justification = "Test file modification";
            } else if (this.isConfigFile(file.path)) {
                classification = "SUPPORTING";
                confidence = "medium";
                justification = "Configuration file change";
            } else {
                classification = "SUSPICIOUS";
                confidence = "low";
                justification = "File change weakly related to task";
            }
        } else if (file.status === "renamed") {
            classification = "SUSPICIOUS";
            confidence = "medium";
            justification = "File rename requires explanation";
        }

        return {
            symbol: {
                path: file.path,
                changeType: file.status,
                additions,
                deletions,
                changes,
                symbols: [],
            },
            classification,
            confidence,
            justification,
            evidence,
        };
    }

    private toChangedSymbol(file: FileDiff, symbol: ExtractedSymbol): ChangedSymbol {
        return {
            id: `${file.path}:${symbol.name}:${symbol.lineRange[0]}`,
            name: symbol.name,
            type: symbol.type,
            filePath: file.path,
            lineRange: symbol.lineRange,
            changeType: file.status,
            visibility: symbol.visibility,
            isExported: symbol.isExported,
            callers: [],
            callees: [],
            implementations: [],
            interfaces: [],
            referencedContracts: [],
            relatedTests: [],
            evidence: [],
        };
    }

    /**
     * Calculate how much a file path matches task keywords
     */
    private calculatePathMatchScore(filePath: string, keywords: string[]): number {
        if (keywords.length === 0) return 0;

        const pathParts = filePath.toLowerCase().split(/[\\/\.]/);
        let matches = 0;

        for (const keyword of keywords) {
            if (pathParts.some((part) => part.includes(keyword))) {
                matches++;
            }
        }

        return matches / keywords.length;
    }

    /**
     * Check if file is a test file
     */
    private isTestFile(filePath: string): boolean {
        return /\.(test|spec)\.(ts|js|tsx|jsx)$/.test(filePath) || filePath.includes("__tests__");
    }

    /**
     * Check if file is a config file
     */
    private isConfigFile(filePath: string): boolean {
        return (
            /\.(config|rc)\.(ts|js|json)$/.test(filePath) ||
            /^\./.test(filePath) ||
            ["package.json", "tsconfig.json", "jest.config.js"].includes(filePath.split("/").pop() || "")
        );
    }

    private isGeneratedFile(filePath: string): boolean {
        return /(?:^|\/)(?:dist|build|generated)\//.test(filePath) || /(?:-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.snap)$/.test(filePath);
    }

    /**
     * Detect scope drift percentage
     */
    detectScopeDrift(
        classifications: ClassifiedChange[],
        totalChanges: number,
    ): number {
        const suspiciousCount = classifications.filter((c) => c.classification === "SUSPICIOUS").length;
        return suspiciousCount / Math.max(totalChanges, 1);
    }

    /**
     * Detect refactor contamination
     */
    detectRefactorContamination(classifications: ClassifiedChange[]): string[] {
        return classifications
            .filter((c) => c.classification === "REFACTOR")
            .map((c) => (typeof c.symbol === "object" && "path" in c.symbol) ? c.symbol.path : "unknown");
    }
}

function rangesOverlap(left: [number, number], right: [number, number]): boolean {
    return left[0] <= right[1] && right[0] <= left[1];
}

export function createChangeAnalyzer(): ChangeAnalyzer {
    return new ChangeAnalyzer();
}
