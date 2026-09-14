import path from "node:path";
import type { ExecutionRequest, ExecutionResult, SandboxPolicy } from "./types.js";

const SHELL_CONTROL_PATTERN = /[;&|<>`$()]/;

export class ExecutionSandbox {
  constructor(private readonly policy: SandboxPolicy) {}

  preflight(request: ExecutionRequest): ExecutionResult {
    const cwd = path.resolve(request.cwd);
    const root = path.resolve(this.policy.workspaceRoot);
    const relative = path.relative(root, cwd);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return this.block("Working directory is outside the workspace root");
    }

    const command = request.command.trim();
    if (!command) return this.block("Command is empty");

    const normalized = command.toLowerCase();
    if (SHELL_CONTROL_PATTERN.test(command)) {
      return this.block("Shell control operators are not allowed");
    }
    if (this.policy.denyPatterns.some((pattern) => normalized.includes(pattern.toLowerCase()))) {
      return this.block("Command matches a denied safety pattern");
    }

    const executable = normalized.split(/\s+/)[0]?.replace(/^['\"]|['\"]$/g, "") ?? "";
    if (this.policy.allowCommands.length > 0 && !this.policy.allowCommands.includes(executable)) {
      return this.block(`Executable is not allowlisted: ${executable}`);
    }
    return { ok: true, exitCode: null, stdout: "", stderr: "", durationMs: 0, blocked: false };
  }

  private block(reason: string): ExecutionResult {
    return { ok: false, exitCode: null, stdout: "", stderr: "", durationMs: 0, blocked: true, reason };
  }
}
