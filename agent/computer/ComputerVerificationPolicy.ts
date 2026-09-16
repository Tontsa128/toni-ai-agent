import type { ComputerPostConditionValidation } from "./ComputerActionResultValidator.js";

export type ComputerVerificationDecision = "complete" | "observe_again" | "stop";

export interface ComputerVerificationPolicyOptions {
  maxObservationAttempts?: number;
}

/** Converts verification state into a bounded next-step decision; it never executes a retry itself. */
export class ComputerVerificationPolicy {
  private readonly maxObservationAttempts: number;

  constructor(options: ComputerVerificationPolicyOptions = {}) {
    const max = options.maxObservationAttempts ?? 2;
    if (!Number.isInteger(max) || max < 1 || max > 3) {
      throw new Error("maxObservationAttempts must be an integer between 1 and 3.");
    }
    this.maxObservationAttempts = max;
  }

  decide(validation: ComputerPostConditionValidation, observationAttempt: number): ComputerVerificationDecision {
    if (!Number.isInteger(observationAttempt) || observationAttempt < 1) {
      throw new Error("observationAttempt must be a positive integer.");
    }
    if (validation.status === "confirmed") return "complete";
    if (validation.status === "not_confirmed") return "stop";
    return observationAttempt < this.maxObservationAttempts ? "observe_again" : "stop";
  }
}
