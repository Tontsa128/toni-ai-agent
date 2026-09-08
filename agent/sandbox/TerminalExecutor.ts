import { spawn } from "node:child_process";
import path from "node:path";
import type { ExecutionRequest, ExecutionResult, SandboxPolicy } from "./types.js";
import { ExecutionSandbox } from "./ExecutionSandbox.js";

export interface TerminalExecutorOptions {
  policy: SandboxPolicy;
  executableAliases?: Record<string, string>;
}

/** Local executor with strict workspace/command controls. This is not a kernel security boundary. */
export class TerminalExecutor {
  private readonly sandbox: ExecutionSandbox;
  private readonly aliases: Record<string, string>;

  constructor(private readonly options: TerminalExecutorOptions) {
    this.sandbox = new ExecutionSandbox(options.policy);
    this.aliases = options.executableAliases ?? {};
  }

  async run(request: ExecutionRequest): Promise<ExecutionResult> {
    const command = this.normalizeCommand(request.command);
    const cwd = path.resolve(request.cwd);
    const preflight = this.sandbox.preflight({ ...request, command, cwd });
    if (!preflight.ok) return preflight;

    const started = Date.now();
    return new Promise((resolve) => {
      const child = spawn(command, {
        cwd,
        shell: true,
        windowsHide: true,
        env: { ...process.env, ...(request.env ?? {}) }
      });
      let stdout = "";
      let stderr = "";
      let settled = false;
      const finish = (result: ExecutionResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const limit = (value: string) => value.slice(0, this.options.policy.maxOutputBytes);
      child.stdout.on("data", (chunk: Buffer | string) => { stdout = limit(stdout + chunk.toString()); });
      child.stderr.on("data", (chunk: Buffer | string) => { stderr = limit(stderr + chunk.toString()); });
      const timer = setTimeout(() => {
        child.kill();
        finish({ ok: false, exitCode: null, stdout, stderr, durationMs: Date.now() - started, blocked: false, reason: "Execution timed out" });
      }, this.options.policy.maxExecutionMs);
      child.on("error", (error) => {
        clearTimeout(timer);
        finish({ ok: false, exitCode: null, stdout, stderr: limit(stderr + error.message), durationMs: Date.now() - started, blocked: false });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        finish({ ok: code === 0, exitCode: code, stdout, stderr, durationMs: Date.now() - started, blocked: false });
      });
    });
  }

  private normalizeCommand(command: string): string {
    const executable = command.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    const alias = this.aliases[executable];
    return alias ? command.replace(/^\S+/, alias) : command;
  }
}
