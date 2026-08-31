#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createAnalysisEngine } from "../../core/engine.js";
import { createReportFormatter } from "../../report/json.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "frankly-demo-"));
try {
  write("package.json", JSON.stringify({ name: "retry-demo", type: "module" }));
  write("tsconfig.json", JSON.stringify({ compilerOptions: { target: "ES2020", module: "ESNext" }, include: ["src"] }));
  write("src/retry-policy.ts", "export const shouldRetry = (status: number) => status >= 500;\n");
  write("src/client.ts", "import { shouldRetry } from './retry-policy.js';\nexport const request = (status: number) => shouldRetry(status);\n");
  write("src/client.test.ts", "import { request } from './client.js';\nif (!request(500)) throw new Error('expected retry');\n");
  git(["init", "-q"]);
  git(["config", "user.email", "demo@frankly.local"]);
  git(["config", "user.name", "Frankly Demo"]);
  git(["add", "."]);
  git(["commit", "-qm", "baseline"]);

  write("src/retry-strategy.ts", "export interface RetryStrategy { retry(status: number): boolean }\nexport class DefaultRetryStrategy implements RetryStrategy { retry(status: number) { return status === 429 || status >= 500; } }\n");
  write("src/client.ts", "import { DefaultRetryStrategy } from './retry-strategy.js';\nconst retry = new DefaultRetryStrategy();\nexport const request = (status: number) => retry.retry(status);\n");
  write("src/unrelated-format.ts", "export const unchangedBehavior = true;\n");

  const result = await (await createAnalysisEngine(root)).analyze("Retry HTTP 429 responses");
  console.log(createReportFormatter().formatAsTerminal(result));
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

function write(name: string, content: string): void {
  const target = path.join(root, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function git(args: string[]): void {
  execFileSync("git", args, { cwd: root });
}
