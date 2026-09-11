import { spawn } from "node:child_process";
import type { ToolDefinition } from "../agent/tools/ToolRegistry.js";

export interface GitReadInput { cwd: string; args: string[]; }

export class GitReadTool implements ToolDefinition<GitReadInput, string> {
  name = "git_read";
  description = "Read Git repository state without modifying it.";
  risk = "green" as const;
  async execute(input: GitReadInput): Promise<string> {
    const allowed = new Set(["status", "diff", "log", "branch", "show", "remote"]);
    if (!input.args.length || !allowed.has(input.args[0] ?? "")) throw new Error("Only read-only git operations are allowed by this tool");
    if (input.args.some((arg) => ["--exec", "--upload-pack", "--receive-pack"].includes(arg))) throw new Error("Unsafe git argument blocked");
    return new Promise((resolve, reject) => {
      const child = spawn("git", input.args, { cwd: input.cwd, windowsHide: true });
      let out = ""; let err = "";
      child.stdout.on("data", (x) => { out += x.toString(); });
      child.stderr.on("data", (x) => { err += x.toString(); });
      child.on("error", reject);
      child.on("close", (code) => code === 0 ? resolve(out) : reject(new Error(err || `git exited with ${code}`)));
    });
  }
}
