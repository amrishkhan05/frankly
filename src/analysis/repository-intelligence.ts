import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import type {
  BehavioralChangeType,
  ChangedSymbol,
  ContractChange,
  CorrectionPlan,
  Evidence,
  ExecutedTest,
  Finding,
  PredictedTest,
} from "../core/models.js";
import type { FileDiff } from "../git/repository.js";

export interface RepositoryIntelligence {
  directCallers: string[];
  transitiveCallers: string[];
  packages: string[];
  predictedTests: PredictedTest[];
  contracts: ContractChange[];
  behavioralChanges: BehavioralChangeType[];
  reuseCandidates: string[];
  findings: Finding[];
  correction?: CorrectionPlan;
}

const SOURCE_RE = /\.[cm]?[jt]sx?$/;
const TEST_RE = /(?:^|\/)(?:__tests__\/.*|.*\.(?:test|spec))\.[cm]?[jt]sx?$/;
const SKIP = new Set([".git", "node_modules", "dist", "build", "coverage", ".next"]);

export function inspectRepository(
  root: string,
  taskKeywords: string[],
  diffs: FileDiff[],
  changedSymbols: ChangedSymbol[],
  executedTests: ExecutedTest[] = [],
): RepositoryIntelligence {
  const sourceFiles = walk(root).filter((file) => SOURCE_RE.test(file));
  const relativeFiles = sourceFiles.map((file) => path.relative(root, file).split(path.sep).join("/"));
  const changed = new Set(diffs.map((file) => file.path));
  const imports = new Map<string, string[]>();
  const contents = new Map<string, string>();

  for (const relative of relativeFiles) {
    const content = fs.readFileSync(path.join(root, relative), "utf8");
    contents.set(relative, content);
    imports.set(relative, extractImports(content).map((specifier) => resolveImport(relative, specifier, relativeFiles)).filter(Boolean) as string[]);
  }

  const directCallers = relativeFiles.filter((file) => imports.get(file)?.some((target) => changed.has(target)));
  const transitive = new Set(directCallers);
  let frontier = [...directCallers];
  while (frontier.length) {
    const targets = new Set(frontier);
    frontier = relativeFiles.filter((file) => !transitive.has(file) && imports.get(file)?.some((target) => targets.has(target)));
    frontier.forEach((file) => transitive.add(file));
  }

  const predictedTests = relativeFiles.filter((file) => TEST_RE.test(file)).flatMap((file): PredictedTest[] => {
    const body = contents.get(file) || "";
    const related = directCallers.includes(file) || imports.get(file)?.some((target) => changed.has(target));
    const mentionsSymbol = changedSymbols.some((symbol) => body.includes(symbol.name.split(".").pop() || symbol.name));
    const sameStem = diffs.some((diff) => path.basename(file).includes(path.basename(diff.path).replace(/\.[^.]+$/, "")));
    if (!related && !mentionsSymbol && !sameStem) return [];
    const status = related || mentionsSymbol ? "LIKELY_AFFECTED" : "POSSIBLY_AFFECTED";
    return [{
      path: file,
      name: path.basename(file),
      status,
      evidence: [{
        type: related ? "IMPORT_DEPENDENCY" : "TEST_REFERENCE",
        confidence: related ? "high" : "medium",
        explanation: related ? "Test imports a changed module" : "Test name or contents reference a changed symbol",
        reference: file,
      }],
    }];
  });

  const contracts = changedSymbols.filter((symbol) => symbol.isExported).map((symbol): ContractChange => ({
    type: symbol.changeType === "added" ? "ADDED" : symbol.changeType === "deleted" ? "REMOVED" : "CHANGED",
    location: `${symbol.filePath}:${symbol.lineRange[0]} ${symbol.name}`,
    severity: symbol.changeType === "added" ? "compatible" : "potentially-breaking",
    confidence: symbol.changeType === "added" ? "high" : "medium",
    affectedCallers: directCallers.filter((file) => imports.get(file)?.includes(symbol.filePath)),
  }));

  const diffText = diffs.flatMap((file) => file.hunks.map((hunk) => hunk.content)).join("\n").toLowerCase();
  const behavioralChanges = behaviorFrom(diffText, diffs);
  const reuseCandidates = findReuseCandidates(taskKeywords, changed, contents, root);
  const findings: Finding[] = [];

  if (reuseCandidates[0]) findings.push(finding(
    "reuse-candidate", "warning", "medium", "Existing code may be reusable",
    `${reuseCandidates[0]} contains task-related symbols or text and is unchanged by this patch.`, [reuseCandidates[0]],
    "Inspect this existing mechanism before keeping a parallel implementation.",
    { type: "EXISTING_UTILITY", confidence: "medium", explanation: "Unchanged repository code matches task intent", reference: reuseCandidates[0] },
  ));

  for (const symbol of changedSymbols.filter((item) => item.changeType === "added" && ["interface", "class"].includes(item.type))) {
    const uses = [...contents.values()].reduce((count, body) => count + occurrences(body, symbol.name), 0);
    if (uses <= 2) findings.push(finding(
      "unnecessary-abstraction",
      "warning",
      "medium",
      "Possible unnecessary abstraction",
      `${symbol.type} ${symbol.name} has no evidence of reuse outside its declaration.`,
      [symbol.id],
      "Keep it local unless another consumer requires the abstraction.",
      { type: "SYMBOL_REFERENCE", confidence: "medium", explanation: `Found ${Math.max(0, uses - 1)} use(s) outside the declaration`, reference: symbol.id },
    ));
  }

  for (const file of diffs.filter((item) => item.path === "package.json" && item.status === "modified")) {
    const additions = file.hunks.flatMap((hunk) => hunk.content.split("\n")).filter((line) => /^\+\s*"[^"]+"\s*:/.test(line));
    if (additions.length) findings.push(finding(
      "dependency-addition", "warning", "high", "Dependency addition needs justification",
      `package.json adds ${additions.length} dependency entry or entries.`, [file.path],
      "Use the runtime or an existing dependency unless the task requires this package.",
      { type: "DEPENDENCY_USAGE", confidence: "high", explanation: additions.join(", "), reference: file.path },
    ));
  }

  if (behavioralChanges.some((type) => type !== "TEST_ONLY" && type !== "REFACTOR_ONLY") && predictedTests.length === 0) {
    findings.push(finding(
      "missing-regression-test", "warning", "medium", "Missing regression coverage",
      `Behavioral change detected (${behavioralChanges.join(", ")}) but no related test was found.`, [],
      "Add one regression test for the changed behavior.",
      { type: "TEST_REFERENCE", confidence: "medium", explanation: "No test imports or references the changed code" },
    ));
  }

  const packages = new Set([...changed, ...directCallers].map((file) => packageFor(root, file)).filter(Boolean) as string[]);
  const removalPaths = diffs.filter((file) =>
    !taskKeywords.some((word) => file.path.toLowerCase().includes(word))
    && !TEST_RE.test(file.path)
    && !imports.get(file.path)?.some((target) => changed.has(target)),
  ).map((file) => file.path);
  const evidence: Evidence[] = removalPaths.map((file) => ({ type: "TASK_MATCH", confidence: "medium", explanation: "No task keyword matched this path", reference: file }));
  const correction = findings.length || removalPaths.length ? {
    pass: 1,
    removals: removalPaths,
    simplifications: findings.filter((item) => item.id.startsWith("unnecessary-abstraction")).map((item) => ({ symbol: item.affectedSymbols[0], suggestion: item.recommendation || "Inline it" })),
    evidence,
    instruction: correctionInstruction([...findings, ...removalPaths.map((file) => finding("scope", "warning", "medium", "Weak task evidence", file, [file], "Remove or justify it", evidence.find((item) => item.reference === file)!))]),
  } satisfies CorrectionPlan : undefined;

  return {
    directCallers,
    transitiveCallers: [...transitive].filter((file) => !directCallers.includes(file)),
    packages: [...packages],
    predictedTests,
    contracts,
    behavioralChanges,
    reuseCandidates,
    findings,
    correction,
  };
}

function walk(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) files.push(full);
    }
  };
  visit(root);
  return files;
}

function extractImports(content: string): string[] {
  const source = ts.createSourceFile("file.ts", content, ts.ScriptTarget.Latest, true);
  return source.statements.flatMap((statement): string[] => {
    if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) return [statement.moduleSpecifier.text];
    return [];
  });
}

function resolveImport(from: string, specifier: string, files: string[]): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier)).replace(/\.js$/, "");
  return files.find((file) => file.replace(/\.[^.]+$/, "") === base || file.replace(/\/index\.[^.]+$/, "") === base);
}

function findReuseCandidates(keywords: string[], changed: Set<string>, contents: Map<string, string>, root: string): string[] {
  const scored: Array<[string, number]> = [];
  for (const [file, body] of contents) {
    if (changed.has(file) || TEST_RE.test(file)) continue;
    const lower = `${file}\n${body}`.toLowerCase();
    const pathScore = keywords.filter((word) => file.toLowerCase().includes(word)).length;
    const score = pathScore * 10 + keywords.filter((word) => lower.includes(word)).length;
    if (score) scored.push([file, score]);
  }
  return scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([file]) => path.relative(root, path.join(root, file)));
}

function behaviorFrom(text: string, diffs: FileDiff[]): BehavioralChangeType[] {
  const found = new Set<BehavioralChangeType>();
  const rules: Array<[RegExp, BehavioralChangeType]> = [
    [/throw|catch|error/, "ERROR_HANDLING"], [/retry|429|backoff/, "RETRY"], [/cache|memo/, "CACHE"],
    [/auth|permission|role/, "AUTHORIZATION"], [/insert|update|delete|save|write/, "STATE_MUTATION"],
    [/route|request|response|status/, "API_BEHAVIOR"], [/env|config/, "CONFIGURATION"], [/promise|async|await|lock/, "CONCURRENCY"],
  ];
  rules.forEach(([pattern, type]) => { if (pattern.test(text)) found.add(type); });
  if (diffs.every((file) => TEST_RE.test(file.path))) found.add("TEST_ONLY");
  return [...found];
}

function packageFor(root: string, file: string): string | undefined {
  let directory = path.dirname(path.join(root, file));
  while (directory.startsWith(root)) {
    const manifest = path.join(directory, "package.json");
    if (fs.existsSync(manifest)) {
      try { return JSON.parse(fs.readFileSync(manifest, "utf8")).name || path.relative(root, directory) || "root"; } catch { return path.relative(root, directory) || "root"; }
    }
    if (directory === root) break;
    directory = path.dirname(directory);
  }
  return undefined;
}

function occurrences(body: string, word: string): number {
  return body.match(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "g"))?.length || 0;
}

function finding(id: string, severity: "error" | "warning" | "info", confidence: "high" | "medium" | "low", title: string, description: string, affectedSymbols: string[], recommendation: string, evidence: Evidence): Finding {
  return { id: `${id}-${affectedSymbols[0] || "change"}`, severity, confidence, title, description, affectedSymbols, recommendation, evidence: [evidence], autoCorrectible: severity !== "error" };
}

function correctionInstruction(findings: Finding[]): string {
  return `Revisit the current patch once. Preserve requested behavior and all validation, security, accessibility, data integrity, error handling, and regression coverage. Do not add functionality. Resolve or justify these red marks:\n${findings.map((item) => `- ${item.title}: ${item.description}`).join("\n")}\nReturn the smallest safe patch that satisfies the task.`;
}
