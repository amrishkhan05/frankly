import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { GitError, RepositoryError } from "../core/errors.js";
import type { ChangeType } from "../core/models.js";

export interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    content: string;
}

export interface FileDiff {
    path: string;
    status: ChangeType;
    hunks: DiffHunk[];
    oldPath?: string;
}

export class Repository {
    constructor(private readonly rootPath: string) {
        try {
            this.git(["rev-parse", "--git-dir"]);
        } catch {
            throw new RepositoryError("Not a git repository", { path: rootPath });
        }
    }

    private git(args: string[], allowFailure = false): string {
        try {
            return execFileSync("git", args, {
                cwd: this.rootPath,
                encoding: "utf8",
                stdio: ["ignore", "pipe", allowFailure ? "ignore" : "pipe"],
            }).trimEnd();
        } catch (error) {
            if (allowFailure) return "";
            throw new GitError(`Git command failed: git ${args.join(" ")}`, { args, error: String(error) });
        }
    }

    getRootPath(): string {
        return this.rootPath;
    }

  async getWorkingTreeDiff(): Promise<FileDiff[]> {
    if (!this.hasHead()) return this.getInitialTreeDiff();
    const tracked = this.git(["diff", "HEAD", "--no-color", "--no-ext-diff", "--find-renames"]);
        const files = this.parseDiff(tracked);
        const known = new Set(files.map((file) => file.path));

        for (const filePath of this.getStatus().untracked) {
            if (known.has(filePath)) continue;
            const fullPath = path.join(this.rootPath, filePath);
            if (!fs.statSync(fullPath).isFile()) continue;
      const content = fs.readFileSync(fullPath, "utf8");
      const lines = lineCount(content);
      files.push({
        path: filePath,
        status: "added",
        hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: lines, content: addedContent(content) }],
            });
        }

        return files;
    }

    async getDiffBetween(base: string, head: string): Promise<FileDiff[]> {
        return this.parseDiff(this.git(["diff", "--no-color", "--no-ext-diff", "--find-renames", base, head]));
    }

    async getStagedDiff(): Promise<FileDiff[]> {
        return this.parseDiff(this.git(["diff", "--staged", "--no-color", "--no-ext-diff", "--find-renames"]));
    }

    fileExists(filePath: string): boolean {
        return this.git(["ls-files", "--error-unmatch", "--", filePath], true) !== "";
    }

    async getFileContent(filePath: string, revision = "HEAD"): Promise<string> {
        const value = this.git(["show", `${revision}:${filePath}`], true);
        if (!value && !this.hasHead()) throw new GitError(`Revision ${revision} does not exist`);
        return value;
    }

    getCurrentBranch(): string {
        return this.git(["rev-parse", "--abbrev-ref", "HEAD"], true) || "HEAD";
    }

    getStatus(): { modified: string[]; staged: string[]; untracked: string[] } {
        const modified: string[] = [];
        const staged: string[] = [];
        const untracked: string[] = [];
        for (const line of this.git(["status", "--porcelain=v1", "-z"]).split("\0")) {
            if (!line) continue;
            const codes = line.slice(0, 2);
            const filePath = line.slice(3);
            if (codes === "??") untracked.push(filePath);
            else {
                if (codes[0] !== " ") staged.push(filePath);
                if (codes[1] !== " ") modified.push(filePath);
            }
        }
        return { modified, staged, untracked };
    }

    async getBlame(filePath: string, line: number): Promise<{ commit: string; author: string } | null> {
        const value = this.git(["blame", "-L", `${line},${line}`, "--porcelain", "--", filePath], true);
        if (!value) return null;
        const rows = value.split("\n");
        return {
            commit: rows[0].split(" ")[0],
            author: rows.find((row) => row.startsWith("author "))?.slice(7) || "unknown",
        };
    }

  private hasHead(): boolean {
        return this.git(["rev-parse", "--verify", "HEAD"], true) !== "";
  }

  private getInitialTreeDiff(): FileDiff[] {
    return this.git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).split("\0").flatMap((filePath): FileDiff[] => {
      if (!filePath) return [];
      const fullPath = path.join(this.rootPath, filePath);
      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return [];
      const content = fs.readFileSync(fullPath, "utf8");
      return [{
        path: filePath,
        status: "added",
        hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: lineCount(content), content: addedContent(content) }],
      }];
    });
  }

    private parseDiff(diff: string): FileDiff[] {
        const files: FileDiff[] = [];
        let current: FileDiff | undefined;
        let hunk: DiffHunk | undefined;

        const flushHunk = () => {
            if (current && hunk) current.hunks.push(hunk);
            hunk = undefined;
        };
        const flushFile = () => {
            flushHunk();
            if (current) files.push(current);
            current = undefined;
        };

        for (const line of diff.split("\n")) {
            if (line.startsWith("diff --git ")) {
                flushFile();
                const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
                current = { path: match?.[2] || "", oldPath: match?.[1], status: "modified", hunks: [] };
            } else if (line.startsWith("new file mode")) {
                if (current) current.status = "added";
            } else if (line.startsWith("deleted file mode")) {
                if (current) current.status = "deleted";
            } else if (line.startsWith("rename from ")) {
                if (current) {
                    current.status = "renamed";
                    current.oldPath = line.slice(12);
                }
            } else if (line.startsWith("rename to ")) {
                if (current) current.path = line.slice(10);
            } else if (line.startsWith("@@")) {
                flushHunk();
                const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
                if (match) hunk = {
                    oldStart: Number(match[1]),
                    oldLines: Number(match[2] ?? 1),
                    newStart: Number(match[3]),
                    newLines: Number(match[4] ?? 1),
                    content: "",
                };
            } else if (hunk && (/^[+\- ]/.test(line) || line.startsWith("\\ No newline"))) {
                hunk.content += `${line}\n`;
            }
        }
        flushFile();
        return files;
    }
}

export function countDiffLines(file: FileDiff): { additions: number; deletions: number } {
  const lines = file.hunks.flatMap((hunk) => hunk.content.split("\n"));
  return {
    additions: lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length,
    deletions: lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length,
  };
}

function lineCount(content: string): number {
  return content === "" ? 0 : content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
}

function addedContent(content: string): string {
  if (!content) return "";
  const body = content.endsWith("\n") ? content.slice(0, -1) : content;
  return body.split("\n").map((line) => `+${line}`).join("\n");
}

export async function createRepository(rootPath: string): Promise<Repository> {
    return new Repository(rootPath);
}
