import type { SelfDebugger, DebugFailure, RepairPlan } from "../debug/SelfDebugger.js";

export interface VerificationCommand {
  name: "check" | "test" | "build";
  command: string;
}

export interface VerificationStepResult {
  name: VerificationCommand["name"];
  command: string;
  ok: boolean;
  skipped: boolean;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  reason?: string;
}

export interface VerificationResult {
  ok: boolean;
  steps: VerificationStepResult[];
  failedStep?: VerificationStepResult;
  repairPlan?: RepairPlan;
}

export interface VerificationRunnerResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  blocked?: boolean;
  reason?: string;
}

export type VerificationRunner = (command: string) => Promise<VerificationRunnerResult>;

/**
 * Runs only the project's known verification scripts. It never invents commands
 * and never retries permission/access failures.
 */
export class VerificationEngine {
  constructor(
    private readonly scripts: Record<string, string>,
    private readonly run: VerificationRunner,
    private readonly debugger?: Pick<SelfDebugger, "analyse">
  ) {}

  availableCommands(): VerificationCommand[] {
    const candidates: VerificationCommand[] = [];
    if (this.scripts.check) candidates.push({ name: "check", command: this.scripts.check });
    else if (this.scripts.typecheck) candidates.push({ name: "check", command: this.scripts.typecheck });
    if (this.scripts.test) candidates.push({ name: "test", command: this.scripts.test });
    if (this.scripts.build) candidates.push({ name: "build", command: this.scripts.build });
    return candidates;
  }

  async verify(): Promise<VerificationResult> {
    const commands = this.availableCommands();
    const steps: VerificationStepResult[] = [];
    if (commands.length === 0) {
      return { ok: true, steps: [{ name: "check", command: "", ok: true, skipped: true, reason: "No verification scripts are configured" }] };
    }

    for (const item of commands) {
      const result = await this.run(item.command);
      const step: VerificationStepResult = {
        name: item.name,
        command: item.command,
        ok: result.ok,
        skipped: false,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        reason: result.reason
      };
      steps.push(step);
      if (!result.ok) {
        const failure: DebugFailure = {
          operation: item.name,
          error: result.reason || result.stderr || `Command exited with code ${result.exitCode}`,
          attempt: 1
        };
        return {
          ok: false,
          steps,
          failedStep: step,
          repairPlan: this.debugger?.analyse(failure)
        };
      }
    }
    return { ok: true, steps };
  }
}
