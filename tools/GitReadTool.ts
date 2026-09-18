import type { ToolDefinition, ToolExecutionContext } from "../agent/tools/ToolRegistry.js";
import { TerminalExecutor } from "../agent/sandbox/TerminalExecutor.js";
import type { SandboxPolicy } from "../agent/sandbox/types.js";

export interface GitReadInput { cwd: string; args: string[]; }

const POLICY: Omit<SandboxPolicy, "workspaceRoot"> = {
  network: "deny",
  maxExecutionMs: 30_000,
  maxOutputBytes: 200_000,
  allowCommands: ["git"],
  denyPatterns: ["--exec", "--upload-pack", "--receive-pack", "push", "commit", "reset", "checkout"]
};

export class GitReadTool implements ToolDefinition<GitReadInput, string> {
  name = "git_read";
  description = "Read Git repository state without modifying it.";
  risk = "green" as const;

  async execute(input: GitReadInput, context?: ToolExecutionContext): Promise<string> {
    const allowed = new Set(["status", "diff", "log", "branch", "show", "remote"]);
    if (!input.args.length || !allowed.has(input.args[0] ?? "")) throw new Error("Only read-only git operations are allowed by this tool");
    if (input.args.some((arg) => ["--exec", "--upload-pack", "--receive-pack"].includes(arg))) throw new Error("Unsafe git argument blocked");
    const executor = new TerminalExecutor({ policy: { ...POLICY, workspaceRoot: input.cwd } });
    const result = await executor.run({ command: ["git", ...input.args].map(value => /\s/.test(value) ? JSON.stringify(value) : value).join(" "), cwd: input.cwd, ...(context?.signal ? { signal: context.signal } : {}) });
    if (!result.ok) throw new Error(result.stderr || result.reason || "git command failed");
    return result.stdout;
  }
}
