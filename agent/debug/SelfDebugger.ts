export type DebugOutcome = "retry" | "repair_plan" | "blocked" | "failed";

export interface DebugFailure {
  operation: string;
  error: string;
  attempt: number;
  changedFiles?: string[];
}

export interface RepairPlan {
  outcome: DebugOutcome;
  summary: string;
  suspectedCause: string;
  nextChecks: string[];
  safeToRetry: boolean;
}

/**
 * Deterministic debugging policy. It stores concise failure summaries, not hidden
 * chain-of-thought, and never grants permission to perform a repair.
 */
export class SelfDebugger {
  constructor(private readonly maxAttempts = 3) {}

  analyse(failure: DebugFailure): RepairPlan {
    const error = failure.error.trim();
    if (!error) {
      return { outcome: "blocked", summary: "Empty error; no retry without observable failure data.", suspectedCause: "unknown", nextChecks: ["capture the command/tool result"], safeToRetry: false };
    }
    if (failure.attempt >= this.maxAttempts) {
      return { outcome: "failed", summary: "Retry limit reached.", suspectedCause: this.classify(error), nextChecks: ["inspect logs and changed files", "prepare a human-reviewed repair plan"], safeToRetry: false };
    }

    const cause = this.classify(error);
    const nextChecks = this.checksFor(cause);
    return {
      outcome: "retry",
      summary: `Attempt ${failure.attempt} failed during ${failure.operation}.`,
      suspectedCause: cause,
      nextChecks,
      safeToRetry: this.isSafeRetry(cause)
    };
  }

  private classify(error: string): string {
    if (/permission|access denied|unauthorized|forbidden/i.test(error)) return "permission_or_access";
    if (/timeout|timed out|abort/i.test(error)) return "timeout_or_network";
    if (/module not found|cannot find package|import/i.test(error)) return "dependency_or_import";
    if (/syntax|type error|ts\d{4}/i.test(error)) return "code_or_type_error";
    if (/enoent|no such file|path/i.test(error)) return "missing_path_or_file";
    return "unknown_runtime_error";
  }

  private checksFor(cause: string): string[] {
    switch (cause) {
      case "dependency_or_import": return ["inspect package.json", "verify the import path and installed dependency", "rerun the narrowest relevant check"];
      case "code_or_type_error": return ["inspect the failing file and compiler message", "make the smallest reversible correction", "rerun the targeted check"];
      case "missing_path_or_file": return ["verify the path relative to workspace root", "check file existence", "retry only after the path is corrected"];
      case "timeout_or_network": return ["check connectivity and endpoint status", "retry once with the existing timeout policy", "do not disable safety timeouts"];
      case "permission_or_access": return ["verify the configured permission", "check whether human approval is required", "do not bypass authentication or access controls"];
      default: return ["capture the complete observable error", "inspect the smallest relevant scope", "prepare a reversible repair"];
    }
  }

  private isSafeRetry(cause: string): boolean {
    return cause !== "permission_or_access";
  }
}
