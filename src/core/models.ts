/**
 * Core data models for Frankly
 * Foundation types for all analysis
 */

// ============================================================================
// Change Symbols and Files
// ============================================================================

export type SymbolType =
    | "function"
    | "method"
    | "class"
    | "interface"
    | "type"
    | "enum"
    | "variable"
    | "constant"
    | "export"
    | "route"
    | "controller"
    | "service"
    | "hook"
    | "component"
    | "schema"
    | "configuration";

export type ChangeType = "added" | "modified" | "deleted" | "renamed";

export type Visibility = "public" | "private" | "protected" | "internal";

export interface ChangedSymbol {
    id: string;
    name: string;
    type: SymbolType;
    filePath: string;
    lineRange: [number, number]; // [start, end]
    changeType: ChangeType;
    visibility: Visibility;
    isExported: boolean;
    callers: string[];
    callees: string[];
    implementations: string[];
    interfaces: string[];
    referencedContracts: string[];
    relatedTests: string[];
    packageName?: string;
    runtimeBoundary?: string;
    evidence: Evidence[];
}

export interface ChangedFile {
    path: string;
    changeType: ChangeType;
    additions: number;
    deletions: number;
    changes: number;
    symbols: ChangedSymbol[];
}

// ============================================================================
// Evidence Model
// ============================================================================

export type EvidenceType =
    | "TASK_MATCH"
    | "SYMBOL_REFERENCE"
    | "CALLER_RELATION"
    | "CALLEE_RELATION"
    | "INTERFACE_IMPLEMENTATION"
    | "IMPORT_DEPENDENCY"
    | "EXPORT_CONTRACT"
    | "TEST_REFERENCE"
    | "CONFIG_REFERENCE"
    | "RUNTIME_BOUNDARY"
    | "GIT_COCHANGE"
    | "SIMILAR_IMPLEMENTATION"
    | "EXISTING_UTILITY"
    | "DEPENDENCY_USAGE"
    | "TYPE_REQUIREMENT"
    | "COMPILE_REQUIREMENT"
    | "DIFF_DEPENDENT"
    | "HISTORICAL_PATTERN";

export type Confidence = "high" | "medium" | "low";

export interface Evidence {
    type: EvidenceType;
    confidence: Confidence;
    explanation: string;
    reference?: string;
}

// ============================================================================
// Change Classification
// ============================================================================

export type ChangeClassification =
    | "REQUIRED"
    | "SUPPORTING"
    | "TEST"
    | "REFACTOR"
    | "INCIDENTAL"
    | "GENERATED"
    | "SUSPICIOUS"
    | "UNEXPLAINED";

export interface ClassifiedChange {
    symbol: ChangedSymbol | ChangedFile;
    classification: ChangeClassification;
    confidence: Confidence;
    justification: string;
    evidence: Evidence[];
}

// ============================================================================
// Behavioral Changes
// ============================================================================

export type BehavioralChangeType =
    | "API_BEHAVIOR"
    | "CONTROL_FLOW"
    | "ERROR_HANDLING"
    | "STATE_MUTATION"
    | "PERSISTENCE"
    | "SECURITY"
    | "AUTHORIZATION"
    | "AUTHENTICATION"
    | "CONCURRENCY"
    | "RETRY"
    | "CACHE"
    | "CONFIGURATION"
    | "DEPENDENCY"
    | "DATABASE_SCHEMA"
    | "PUBLIC_CONTRACT"
    | "EVENT"
    | "MESSAGE_SCHEMA"
    | "TEST_ONLY"
    | "REFACTOR_ONLY";

// ============================================================================
// Contract Changes
// ============================================================================

export type ContractChangeType =
    | "ADDED"
    | "REMOVED"
    | "WIDENED"
    | "NARROWED"
    | "CHANGED";

export interface ContractChange {
    type: ContractChangeType;
    location: string;
    oldSignature?: string;
    newSignature?: string;
    severity: "breaking" | "potentially-breaking" | "compatible";
    confidence: Confidence;
    affectedCallers?: string[];
}

// ============================================================================
// Findings and Recommendations
// ============================================================================

export type FindingSeverity = "error" | "warning" | "info";

export interface Finding {
    id: string;
    severity: FindingSeverity;
    confidence: Confidence;
    title: string;
    description: string;
    affectedSymbols: string[];
    evidence: Evidence[];
    recommendation?: string;
    autoCorrectible?: boolean;
}

// ============================================================================
// Verdict and Review
// ============================================================================

export type Verdict = "CLEAN" | "REVIEW" | "SIMPLIFY" | "SPLIT" | "VERIFY" | "BLOCK";

export interface RedInkReview {
    task: string;
    verdict: Verdict;
    taskAlignment: "high" | "medium" | "low";
    changeNecessity: number; // 0-100
    changeSurface: "LOW" | "MEDIUM" | "HIGH";
    scopeDrift: number; // 0-1 (percentage)
    findings: Finding[];
    blastRadius: {
        directCallers: number;
        transitiveCallers: number;
        affectedPackages: number;
        callers: string[];
        packages: string[];
    };
    testImpact: {
        likelyAffected: number;
        possiblyAffected: number;
        executed: number;
        passed: number;
        predicted: PredictedTest[];
        executedResults: ExecutedTest[];
    };
    contractChanges: ContractChange[];
    behavioralChanges: BehavioralChangeType[];
    reuseCandidates: string[];
    correction?: CorrectionPlan;
    recommendation: string;
    personality?: string;
}

// ============================================================================
// Analysis Result
// ============================================================================

export interface AnalysisResult {
    schemaVersion: "1";
    repository: string;
    task: string;
    files: ChangedFile[];
    symbols: ChangedSymbol[];
    classifications: ClassifiedChange[];
    findings: Finding[];
    review: RedInkReview;
    timestamp: number;
    duration: number; // ms
}

export interface TaskPlan {
    task: string;
    normalizedIntent: string;
    keywords: string[];
    estimatedFiles: number;
    expectedSymbols: [number, number];
    expectedTests: number;
    expectsDependency: boolean;
    expectsPublicContract: boolean;
    likelyTouchedAreas: string[];
    reuseCandidates: string[];
    confidence: "high" | "medium" | "low";
    concerns: string[];
}

// ============================================================================
// Test Impact
// ============================================================================

export type PredictedTestStatus = "LIKELY_AFFECTED" | "POSSIBLY_AFFECTED" | "UNLIKELY_AFFECTED";
export type ExecutedTestStatus = "PASSED" | "FAILED" | "SKIPPED" | "NOT_RUN";

export interface PredictedTest {
    path: string;
    name: string;
    status: PredictedTestStatus;
    evidence: Evidence[];
}

export interface ExecutedTest {
    path: string;
    name: string;
    status: ExecutedTestStatus;
    duration?: number;
}

// ============================================================================
// Correction Plan
// ============================================================================

export interface CorrectionPlan {
    pass: number;
    removals: string[]; // symbol IDs
    simplifications: { symbol: string; suggestion: string }[];
    evidence: Evidence[];
    instruction: string;
}
