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
    const parsed = this.parseCommand(request.command);
    if (!parsed) return this.blocked("Command could not be parsed safely");
    const [rawExecutable, ...args] = parsed;
    const executable = this.normalizeExecutable(rawExecutable);
    const normalizedCommand = [executable, ...args].map(quoteForPreflight).join(" ");
    const cwd = path.resolve(request.cwd);
    const preflight = this.sandbox.preflight({ ...request, command: normalizedCommand, cwd });
    if (!preflight.ok) return preflight;

    const started = Date.now();
    return new Promise((resolve) => {
      const child = spawn(executable, args, {
        cwd,
        shell: false,
        windowsHide: true,
        env: { ...process.env, ...(request.env ?? {}) },
        stdio: ["ignore", "pipe", "pipe"]
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
      child.stdout?.on("data", (chunk: Buffer | string) => { stdout = limit(stdout + chunk.toString()); });
      child.stderr?.on("data", (chunk: Buffer | string) => { stderr = limit(stderr + chunk.toString()); });
      const timer = setTimeout(() => {
        child.kill();
        finish({ ok: false, exitCode: null, stdout, stderr, durationMs: Date.now() - started, blocked: false, reason: "Execution timed out" });
      }, this.options.policy.maxExecutionMs);
      child.on("error", (error) => {
        clearTimeout(timer);
        finish({ ok: false, exitCode: null, stdout, stderr: limit(`${stderr}${error.message}`), durationMs: Date.now() - started, blocked: false });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        finish({ ok: code === 0, exitCode: code, stdout, stderr, durationMs: Date.now() - started, blocked: false });
      });
    });
  }

  private parseCommand(command: string): string[] | undefined {
    const input = command.trim();
    if (!input || input.length > 4096) return undefined;
    const args: string[] = [];
    let current = "";
    let quote: "'" | '"' | undefined;
    let escaping = false;
    let tokenStarted = false;

    for (const char of input) {
      if (escaping) {
        current += char;
        escaping = false;
        tokenStarted = true;
        continue;
      }
      if (char === "\\" && quote !== "'") {
        escaping = true;
        tokenStarted = true;
        continue;
      }
      if (quote) {
        if (char === quote) quote = undefined;
        else current += char;
        tokenStarted = true;
        continue;
      }
      if (char === "'" || char === '"') {
        quote = char;
        tokenStarted = true;
      } else if (/\s/.test(char)) {
        if (tokenStarted) {
          args.push(current);
          current = "";
          tokenStarted = false;
        }
      } else {
        current += char;
        tokenStarted = true;
      }
    }
    if (escaping || quote || tokenStarted) args.push(current);
    if (quote || args.length === 0 || args.length > 64 || args.some((arg) => arg.length > 4096)) return undefined;
    return args;
  }

  private normalizeExecutable(executable: string): string {
    const key = executable.toLowerCase();
    const alias = this.aliases[key] ?? executable;
    if (process.platform === "win32") {
      const lower = alias.toLowerCase();
      if (["npm", "npx", "pnpm", "yarn"].includes(lower) && !lower.endsWith(".cmd")) return `${alias}.cmd`;
    }
    return alias;
  }

  private blocked(reason: string): ExecutionResult {
    return { ok: false, exitCode: null, stdout: "", stderr: "", durationMs: 0, blocked: true, reason };
  }
}

function quoteForPreflight(value: string): string {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}
