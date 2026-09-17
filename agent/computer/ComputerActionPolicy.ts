export type ComputerActionRisk = "safe" | "approval_required" | "never_auto";

export interface ComputerActionPolicyDecision {
  risk: ComputerActionRisk;
  allowed: boolean;
  reason: string;
}

/**
 * Central, deterministic classification guard for computer input.
 * This policy never grants execution; SupervisedToolExecutor remains authoritative.
 */
export class ComputerActionPolicy {
  decide(action: "click" | "type" | "keypress"): ComputerActionPolicyDecision {
    if (action === "click" || action === "type" || action === "keypress") {
      return {
        risk: "approval_required",
        allowed: false,
        reason: "Computer input requires explicit human approval before execution."
      };
    }
    return { risk: "never_auto", allowed: false, reason: "Unsupported computer action." };
  }
}
