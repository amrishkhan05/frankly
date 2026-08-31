/**
 * Symbol extraction from TypeScript/JavaScript code
 * Uses TypeScript Compiler API for semantic analysis
 */

import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import type { ChangedSymbol, SymbolType, Visibility } from "../core/models.js";
import { SemanticError } from "../core/errors.js";

export interface ExtractedSymbol {
    name: string;
    type: SymbolType;
    visibility: Visibility;
    isExported: boolean;
    line: number;
    column: number;
    lineRange: [number, number];
}

export class SymbolExtractor {
    private compilerOptions: ts.CompilerOptions;
    private rootPath: string;

    constructor(rootPath: string, tsConfigPath?: string) {
        this.rootPath = rootPath;
        this.compilerOptions = this.loadCompilerOptions(tsConfigPath);
    }

    /**
     * Load TypeScript compiler options
     */
    private loadCompilerOptions(tsConfigPath?: string): ts.CompilerOptions {
        let configPath = tsConfigPath || path.join(this.rootPath, "tsconfig.json");

        if (!fs.existsSync(configPath)) {
            // Use default options
            return {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.ESNext,
                lib: ["es2020"],
                strict: true,
                moduleResolution: ts.ModuleResolutionKind.Bundler,
            };
        }

        try {
            const configFile = ts.readConfigFile(configPath, (p) => fs.readFileSync(p, "utf-8"));
            const config = ts.parseJsonConfigFileContent(
                configFile.config,
                ts.sys,
                path.dirname(configPath),
            );
            return config.options;
        } catch (error) {
            throw new SemanticError("Failed to load TypeScript config", { error, path: configPath });
        }
    }

    /**
     * Extract symbols from a file
     */
    extractSymbols(filePath: string): ExtractedSymbol[] {
        try {
            const sourceText = fs.readFileSync(filePath, "utf-8");
            const sourceFile = ts.createSourceFile(
                filePath,
                sourceText,
                this.compilerOptions.target || ts.ScriptTarget.ES2020,
                true,
            );

            const symbols: ExtractedSymbol[] = [];
            this.visitNode(sourceFile, symbols, sourceText);
            return symbols;
        } catch (error) {
            throw new SemanticError("Failed to extract symbols", { error, filePath });
        }
    }

    /**
     * Recursively visit AST nodes
     */
    private visitNode(node: ts.Node, symbols: ExtractedSymbol[], sourceText: string): void {
        // Function declarations
        if (ts.isFunctionDeclaration(node)) {
            const name = node.name?.text || "anonymous";
            const isExported = this.isExported(node);
            const lineRange = this.getLineRange(node, sourceText);
            const line = ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line;

            symbols.push({
                name,
                type: "function",
                visibility: this.getVisibility(node),
                isExported,
                line,
                column: ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).character,
                lineRange,
            });
        }

        // Class declarations
        if (ts.isClassDeclaration(node)) {
            const name = node.name?.text || "anonymous";
            const isExported = this.isExported(node);
            const lineRange = this.getLineRange(node, sourceText);
            const line = ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line;

            symbols.push({
                name,
                type: "class",
                visibility: this.getVisibility(node),
                isExported,
                line,
                column: ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).character,
                lineRange,
            });

            // Extract class methods
            for (const member of node.members) {
                if (ts.isMethodDeclaration(member)) {
                    const methodName = member.name?.getText() || "anonymous";
                    const memberLineRange = this.getLineRange(member, sourceText);
                    const memberLine = ts.getLineAndCharacterOfPosition(
                        node.getSourceFile(),
                        member.getStart(),
                    ).line;

                    symbols.push({
                        name: `${name}.${methodName}`,
                        type: "method",
                        visibility: this.getVisibility(member),
                        isExported: false,
                        line: memberLine,
                        column: ts.getLineAndCharacterOfPosition(node.getSourceFile(), member.getStart())
                            .character,
                        lineRange: memberLineRange,
                    });
                }
            }
        }

        // Interface declarations
        if (ts.isInterfaceDeclaration(node)) {
            const name = node.name?.text || "anonymous";
            const isExported = this.isExported(node);
            const lineRange = this.getLineRange(node, sourceText);
            const line = ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line;

            symbols.push({
                name,
                type: "interface",
                visibility: this.getVisibility(node),
                isExported,
                line,
                column: ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).character,
                lineRange,
            });
        }

        // Type aliases
        if (ts.isTypeAliasDeclaration(node)) {
            const name = node.name?.text || "anonymous";
            const isExported = this.isExported(node);
            const lineRange = this.getLineRange(node, sourceText);
            const line = ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line;

            symbols.push({
                name,
                type: "type",
                visibility: this.getVisibility(node),
                isExported,
                line,
                column: ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).character,
                lineRange,
            });
        }

        // Variable declarations
        if (ts.isVariableStatement(node)) {
            for (const decl of node.declarationList.declarations) {
                const name = decl.name.getText();
                const isExported = this.isExported(node);
                const lineRange = this.getLineRange(decl, sourceText);
                const line = ts.getLineAndCharacterOfPosition(node.getSourceFile(), decl.getStart()).line;

                symbols.push({
                    name,
                    type: decl.initializer ? "variable" : "constant",
                    visibility: this.getVisibility(node),
                    isExported,
                    line,
                    column: ts.getLineAndCharacterOfPosition(node.getSourceFile(), decl.getStart()).character,
                    lineRange,
                });
            }
        }

        // Export declarations
        if (ts.isExportDeclaration(node)) {
            symbols.push({
                name: "export",
                type: "export",
                visibility: "public",
                isExported: true,
                line: ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line,
                column: ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).character,
                lineRange: this.getLineRange(node, sourceText),
            });
        }

        ts.forEachChild(node, (child) => this.visitNode(child, symbols, sourceText));
    }

    /**
     * Check if node is exported
     */
    private isExported(node: ts.Node): boolean {
        const flags = ts.getCombinedModifierFlags(node as ts.Declaration);
        return (flags & ts.ModifierFlags.Export) !== 0;
    }

    /**
     * Get visibility level
     */
    private getVisibility(node: ts.Node): Visibility {
        const flags = ts.getCombinedModifierFlags(node as ts.Declaration);

        if (flags & ts.ModifierFlags.Private) return "private";
        if (flags & ts.ModifierFlags.Protected) return "protected";
        if (flags & ts.ModifierFlags.Public) return "public";

        return "internal";
    }

    /**
     * Get line range of a node
     */
    private getLineRange(node: ts.Node, sourceText: string): [number, number] {
        const sourceFile = node.getSourceFile();
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line;
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line;
        return [start + 1, end + 1]; // Convert to 1-based
    }
}

export function createSymbolExtractor(
    rootPath: string,
    tsConfigPath?: string,
): SymbolExtractor {
    return new SymbolExtractor(rootPath, tsConfigPath);
}
