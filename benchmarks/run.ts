import * as fs from "node:fs";
import * as path from "node:path";
import { createAnalysisEngine } from "../src/core/engine.js";

const file = process.argv[2] || path.join(process.cwd(), "benchmarks/tasks.example.json");
const cases = JSON.parse(fs.readFileSync(file, "utf8")) as Array<{ name: string; repository: string; task: string }>;
const results = [];

for (const item of cases) {
  const repository = path.resolve(path.dirname(file), item.repository);
  const result = await (await createAnalysisEngine(repository)).analyze(item.task);
  results.push({
    name: item.name,
    files: result.files.length,
    changedLines: result.files.reduce((sum, changed) => sum + changed.additions + changed.deletions, 0),
    symbols: result.symbols.length,
    findings: result.findings.length,
    scopeDrift: result.review.scopeDrift,
    verdict: result.review.verdict,
    durationMs: result.duration,
  });
}

process.stdout.write(`${JSON.stringify({ measuredAt: new Date().toISOString(), cases: results }, null, 2)}\n`);
