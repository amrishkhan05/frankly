#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createAnalysisEngine } from "../../core/engine.js";
import { createReportFormatter } from "../../report/json.js";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "frankly-demo-"));
const fixtureRoot = fileURLToPath(new URL("../../../fixtures/retry-429", import.meta.url));
try {
    copyFixture("baseline");
    git(["init", "-q"]);
    git(["config", "user.email", "demo@frankly.local"]);
    git(["config", "user.name", "Frankly Demo"]);
    git(["add", "."]);
    git(["commit", "-qm", "baseline"]);

    copyFixture("candidate");

    const result = await (await createAnalysisEngine(root)).analyze("Retry HTTP 429 responses");
    console.log(createReportFormatter().formatAsTerminal(result));
} finally {
    fs.rmSync(root, { recursive: true, force: true });
}

function copyFixture(name: "baseline" | "candidate"): void {
    fs.cpSync(path.join(fixtureRoot, name), root, { recursive: true });
}

function git(args: string[]): void {
    execFileSync("git", args, { cwd: root });
}
