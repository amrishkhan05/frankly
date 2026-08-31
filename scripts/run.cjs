#!/usr/bin/env node
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mode = process.argv[2] || "mcp";
const data = process.env.FRANKLY_PLUGIN_DATA || (mode === "checkpoint" ? process.argv[3] : undefined) || root;

if (data !== root) {
  const marker = path.join(data, ".frankly-version");
  const version = require(path.join(root, "package.json")).version;
  if (!fs.existsSync(marker) || fs.readFileSync(marker, "utf8") !== version) {
    fs.mkdirSync(data, { recursive: true });
    fs.cpSync(path.join(root, "src"), path.join(data, "src"), { recursive: true });
    fs.copyFileSync(path.join(root, "package.json"), path.join(data, "package.json"));
    execFileSync("npm", ["install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: data, stdio: "inherit" });
    fs.writeFileSync(marker, version);
  }
}

const entry = mode === "checkpoint"
  ? "src/integrations/claude/checkpoint.ts"
  : mode === "mcp"
    ? "src/integrations/mcp/index.ts"
    : "src/integrations/cli/index.ts";
const tsx = path.join(data, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
const result = spawnSync(tsx, [path.join(data, entry), ...(mode === "checkpoint" || mode === "mcp" ? [] : process.argv.slice(2))], {
  cwd: process.cwd(),
  stdio: "inherit",
});
process.exit(result.status ?? 1);
