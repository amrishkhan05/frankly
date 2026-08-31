/**
 * Report formatting
 * Outputs analysis results in various formats
 */

import type { AnalysisResult, RedInkReview, Finding } from "../core/models.js";

export class ReportFormatter {
    /**
     * Format as JSON
     */
    formatAsJson(result: AnalysisResult): string {
        return JSON.stringify(result, null, 2);
    }

    /**
     * Format as compact terminal output
     */
    formatAsTerminal(result: AnalysisResult): string {
        const lines: string[] = [];

        lines.push("FRANKLY · RED INK REVIEW\n");

        // Task
        lines.push(`Task\n${result.task}\n`);

        // Verdict
        const review = result.review;
        lines.push(`CHANGE VERDICT\n${review.verdict}\n`);

        // Metrics
        lines.push(`TASK ALIGNMENT\n${review.taskAlignment}\n`);
        lines.push(`CHANGE NECESSITY\n${review.changeNecessity}/100\n`);
        lines.push(`CHANGE SURFACE\n${review.changeSurface}\n`);
    lines.push(`SCOPE DRIFT\n${Math.round(review.scopeDrift * 100)}%\n`);
    lines.push(`MINIMUM PATCH\n${result.files.length} file(s), ${result.symbols.length} changed symbol(s)\n`);

        // Red marks
        if (review.findings.length > 0) {
            lines.push("RED MARKS\n");
            for (const finding of review.findings) {
                const icon = finding.severity === "error" ? "✗" : "⚠";
                lines.push(`${icon} ${finding.title}`);
            }
            lines.push("");
        }

        // Blast radius
        lines.push("BLAST RADIUS\n");
        lines.push(`Direct callers       ${review.blastRadius.directCallers}`);
        lines.push(`Transitive callers   ${review.blastRadius.transitiveCallers}`);
        lines.push(`Packages             ${review.blastRadius.affectedPackages}\n`);

        // Test impact
        lines.push("TEST IMPACT\n");
        lines.push(`Likely affected      ${review.testImpact.likelyAffected}`);
        lines.push(`Possibly affected    ${review.testImpact.possiblyAffected}`);
        lines.push(`Executed             ${review.testImpact.executed}`);
    lines.push(`Passed               ${review.testImpact.passed}\n`);
    for (const test of review.testImpact.predicted.slice(0, 10)) {
      lines.push(`  ${test.status.padEnd(19)} ${test.path}`);
    }
    if (review.testImpact.predicted.length) lines.push("");

    if (review.contractChanges.length) {
      lines.push("CONTRACT CHANGES\n");
      for (const contract of review.contractChanges.slice(0, 10)) lines.push(`⚠ ${contract.type} ${contract.location}`);
      lines.push("");
    }

        // Recommendation
        lines.push("RECOMMENDATION\n");
    lines.push(review.recommendation);

    if (review.correction) lines.push(`\nCORRECTION PASS (1/1)\n${review.correction.instruction}`);

        if (review.personality) {
            lines.push(`\nFrank: "${review.personality}"`);
        }

        return lines.join("\n");
    }

    /**
     * Format as markdown
     */
    formatAsMarkdown(result: AnalysisResult): string {
        const lines: string[] = [];

        lines.push("# Frankly · Red Ink Review\n");

        // Task
        lines.push(`## Task\n${result.task}\n`);

        // Verdict
        const review = result.review;
        lines.push(`## Change Verdict\n**${review.verdict}**\n`);

        // Metrics
        lines.push("## Analysis\n");
        lines.push(`- **Task Alignment**: ${review.taskAlignment}`);
        lines.push(`- **Change Necessity**: ${review.changeNecessity}/100`);
        lines.push(`- **Change Surface**: ${review.changeSurface}`);
    lines.push(`- **Scope Drift**: ${Math.round(review.scopeDrift * 100)}%\n`);
    lines.push(`- **Behavioral Changes**: ${review.behavioralChanges.join(", ") || "none detected"}`);

        // Findings
        if (review.findings.length > 0) {
            lines.push("## Findings\n");
            for (const finding of review.findings) {
                lines.push(
                    `- **${finding.title}** (${finding.severity})\n  ${finding.description}`,
                );
            }
            lines.push("");
        }

        // Impact
        lines.push("## Impact\n");
        lines.push("### Blast Radius");
        lines.push(`- Direct callers: ${review.blastRadius.directCallers}`);
        lines.push(`- Transitive callers: ${review.blastRadius.transitiveCallers}`);
        lines.push(`- Affected packages: ${review.blastRadius.affectedPackages}\n`);

        lines.push("### Test Impact");
        lines.push(`- Likely affected: ${review.testImpact.likelyAffected}`);
        lines.push(`- Possibly affected: ${review.testImpact.possiblyAffected}`);
        lines.push(`- Executed: ${review.testImpact.executed}`);
        lines.push(`- Passed: ${review.testImpact.passed}\n`);

        // Recommendation
        lines.push("## Recommendation\n");
    lines.push(review.recommendation);

    if (review.correction) lines.push(`\n## Correction Pass\n\n${review.correction.instruction}`);

        return lines.join("\n");
    }

    /**
     * Format as summary
     */
  formatAsSummary(result: AnalysisResult): string {
        const review = result.review;
        return `
FRANKLY ANALYSIS

Verdict: ${review.verdict}
Files changed: ${result.files.length}
Symbols changed: ${result.symbols.length}
Findings: ${review.findings.length}
Task alignment: ${review.taskAlignment}
Change necessity: ${review.changeNecessity}/100

${review.recommendation}
    `.trim();
  }

  formatAsCi(result: AnalysisResult): string {
    return JSON.stringify({
      schemaVersion: result.schemaVersion,
      verdict: result.review.verdict,
      necessityScore: result.review.changeNecessity,
      scopeDrift: result.review.scopeDrift,
      findings: result.review.findings.map(({ id, severity, confidence, title, affectedSymbols }) => ({ id, severity, confidence, title, affectedSymbols })),
      predictedTests: result.review.testImpact.predicted,
      executedTests: result.review.testImpact.executedResults,
      contracts: result.review.contractChanges,
    });
  }
}

export function createReportFormatter(): ReportFormatter {
    return new ReportFormatter();
}
