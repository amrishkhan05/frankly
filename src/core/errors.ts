/**
 * Core error types and utilities
 */

export class FranklyError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = "FranklyError";
    }
}

export class RepositoryError extends FranklyError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, "REPOSITORY_ERROR", details);
        this.name = "RepositoryError";
    }
}

export class GitError extends FranklyError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, "GIT_ERROR", details);
        this.name = "GitError";
    }
}

export class ProjectError extends FranklyError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, "PROJECT_ERROR", details);
        this.name = "ProjectError";
    }
}

export class SemanticError extends FranklyError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, "SEMANTIC_ERROR", details);
        this.name = "SemanticError";
    }
}

export class ConfigError extends FranklyError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, "CONFIG_ERROR", details);
        this.name = "ConfigError";
    }
}

export class AnalysisError extends FranklyError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, "ANALYSIS_ERROR", details);
        this.name = "AnalysisError";
    }
}
