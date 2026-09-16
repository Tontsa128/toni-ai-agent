export type ComputerActionRisk = "safe" | "approval_required" | "never_auto";

export interface ComputerActionPolicyDecision {
  risk: ComputerActionRisk;
  allowed: boolean;
  reason: string;
}

/** Central, deterministic guard for computer actions before they reach the supervisor. */
export class ComputerActionPolicy {
  decide(action: "click" | "type" | "keypress", approved: boolean): ComputerActionPolicyDecision {
    if (action === "type" || action === "keypress" || action === "click") {
      if (!approved) {
        return { risk: "approval_required", allowed: false, reason: "Explicit human approval is required for computer input." };
      }
      return { risk: "approval_required", allowed: true, reason: "Computer input may proceed only after explicit human approval." };
    }
    return { risk: "never_auto", allowed: false, reason: "Unsupported computer action." };
  }
}
