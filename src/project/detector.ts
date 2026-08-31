/**
 * Project detection and analysis
 * Identifies TypeScript/JavaScript projects, workspaces, and configuration
 */

import * as fs from "fs";
import * as path from "path";
import { ProjectError } from "../core/errors.js";

export type PackageManager = "npm" | "pnpm" | "yarn";

export interface Project {
    root: string;
    type: "typescript" | "javascript";
    packageManager: PackageManager;
    isWorkspace: boolean;
    workspaceRoot?: string;
    packages?: string[];
    hasTsConfig: boolean;
    testRunner?: "jest" | "vitest" | "nx";
}

export class ProjectDetector {
    private rootPath: string;
    private cache: Map<string, unknown> = new Map();

    constructor(rootPath: string) {
        this.rootPath = rootPath;
    }

    /**
     * Detect project configuration
     */
    async detectProject(): Promise<Project> {
        const cacheKey = "project";
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey) as Project;
        }

        const packageJson = this.readPackageJson(this.rootPath);
        if (!packageJson) {
            throw new ProjectError("No package.json found", { path: this.rootPath });
        }

        const project: Project = {
            root: this.rootPath,
            type: this.detectLanguageType(),
            packageManager: this.detectPackageManager(),
            isWorkspace: this.isWorkspace(packageJson),
            hasTsConfig: this.hasTsConfig(this.rootPath),
            testRunner: this.detectTestRunner(packageJson),
        };

        if (project.isWorkspace) {
            project.workspaceRoot = this.rootPath;
            project.packages = this.detectWorkspacePackages(packageJson);
        }

        this.cache.set(cacheKey, project);
        return project;
    }

    /**
     * Detect language type from tsconfig or file extensions
     */
    private detectLanguageType(): "typescript" | "javascript" {
        if (this.hasTsConfig(this.rootPath)) {
            return "typescript";
        }
        // Check for .ts files
        return this.hasTypeScriptFiles(this.rootPath) ? "typescript" : "javascript";
    }

    /**
     * Check if tsconfig.json exists
     */
    private hasTsConfig(dir: string): boolean {
        return fs.existsSync(path.join(dir, "tsconfig.json"));
    }

    /**
     * Check for TypeScript files
     */
    private hasTypeScriptFiles(dir: string, depth = 2): boolean {
        if (depth <= 0) return false;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
                if (entry.isFile() && entry.name.endsWith(".ts")) return true;
                if (entry.isDirectory() && this.hasTypeScriptFiles(path.join(dir, entry.name), depth - 1)) {
                    return true;
                }
            }
        } catch {
            // Ignore errors
        }
        return false;
    }

    /**
     * Detect package manager from lock files
     */
    private detectPackageManager(): PackageManager {
        if (fs.existsSync(path.join(this.rootPath, "pnpm-lock.yaml"))) return "pnpm";
        if (fs.existsSync(path.join(this.rootPath, "yarn.lock"))) return "yarn";
        return "npm";
    }

    /**
     * Check if project is a workspace
     */
    private isWorkspace(packageJson: Record<string, unknown>): boolean {
        return (
            Array.isArray(packageJson.workspaces) || typeof packageJson.workspaces === "object"
        );
    }

    /**
     * Detect workspace packages
     */
    private detectWorkspacePackages(packageJson: Record<string, unknown>): string[] {
        const workspaces = packageJson.workspaces;
        if (!workspaces) return [];

        let patterns: string[] = [];
        if (Array.isArray(workspaces)) {
            patterns = workspaces as string[];
        } else if (typeof workspaces === "object" && workspaces !== null) {
            const w = workspaces as Record<string, unknown>;
            if (Array.isArray(w.packages)) {
                patterns = w.packages as string[];
            }
        }

        // Resolve glob patterns to actual packages
        const packages: string[] = [];
        for (const pattern of patterns) {
            const resolved = this.resolveGlobPattern(pattern);
            packages.push(...resolved);
        }

        return packages;
    }

    /**
     * Resolve glob pattern to actual directories
     */
    private resolveGlobPattern(pattern: string): string[] {
        const result: string[] = [];
        if (!pattern.includes("*")) {
            const fullPath = path.join(this.rootPath, pattern);
            if (fs.existsSync(fullPath)) {
                result.push(pattern);
            }
            return result;
        }

        // Simple glob resolution
        const parts = pattern.split("/");
        const basePart = parts[0];

        if (basePart.includes("*")) {
            const basePattern = basePart.replace("*", "");
            try {
                const entries = fs.readdirSync(this.rootPath);
                for (const entry of entries) {
                    if (entry.startsWith(basePattern)) {
                        const fullPath = path.join(this.rootPath, entry);
                        if (fs.statSync(fullPath).isDirectory()) {
                            result.push(entry);
                        }
                    }
                }
            } catch {
                // Ignore errors
            }
        }

        return result;
    }

    /**
     * Detect test runner from package.json
     */
    private detectTestRunner(packageJson: Record<string, unknown>): "jest" | "vitest" | "nx" | undefined {
        const deps = {
            ...((packageJson.dependencies as Record<string, unknown>) || {}),
            ...((packageJson.devDependencies as Record<string, unknown>) || {}),
        };

        if ("nx" in deps) return "nx";
        if ("vitest" in deps) return "vitest";
        if ("jest" in deps) return "jest";
        return undefined;
    }

    /**
     * Read package.json from directory
     */
    private readPackageJson(dir: string): Record<string, unknown> | null {
        const packageJsonPath = path.join(dir, "package.json");
        try {
            const content = fs.readFileSync(packageJsonPath, "utf-8");
            return JSON.parse(content) as Record<string, unknown>;
        } catch {
            return null;
        }
    }

    /**
     * Find package.json for a given file path
     */
    findPackageJsonForFile(filePath: string): string | null {
        let dir = path.dirname(filePath);
        while (dir !== path.dirname(dir)) {
            const packageJsonPath = path.join(dir, "package.json");
            if (fs.existsSync(packageJsonPath)) {
                return packageJsonPath;
            }
            dir = path.dirname(dir);
        }
        return null;
    }

    /**
     * Read tsconfig.json
     */
    readTsConfig(dir: string = this.rootPath): Record<string, unknown> | null {
        const tsConfigPath = path.join(dir, "tsconfig.json");
        try {
            const content = fs.readFileSync(tsConfigPath, "utf-8");
            return JSON.parse(content) as Record<string, unknown>;
        } catch {
            return null;
        }
    }
}

export async function createProjectDetector(rootPath: string): Promise<ProjectDetector> {
    return new ProjectDetector(rootPath);
}
