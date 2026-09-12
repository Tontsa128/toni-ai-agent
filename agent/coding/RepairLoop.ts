import type { RepairPlan } from "../debug/SelfDebugger.js";
import type { VerificationResult } from "./VerificationEngine.js";

export interface RepairAttempt {
  attempt: number;
  verification: VerificationResult;
  repairPlan?: RepairPlan;
  repaired: boolean;
  stopped: boolean;
  reason?: string;
}

export interface RepairLoopResult {
  ok: boolean;
  attempts: RepairAttempt[];
  finalVerification: VerificationResult;
}

export interface RepairLoopOptions {
  maxAttempts?: number;
}

export type RepairAction = (plan: RepairPlan, attempt: number) => Promise<boolean>;
export type VerificationAction = (attempt: number) => Promise<VerificationResult>;

/**
 * Bounded verification/repair coordinator.
 *
 * The loop does not edit files itself. A repair action is injected by the coding
 * layer and must remain behind the normal supervised tool/approval boundary.
 * Permission/access failures are never retried automatically.
 */
export class RepairLoop {
  private readonly maxAttempts: number;

  constructor(options: RepairLoopOptions = {}) {
    this.maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 3, 3));
  }

  async run(verify: VerificationAction, repair: RepairAction): Promise<RepairLoopResult> {
    const attempts: RepairAttempt[] = [];
    let finalVerification = await verify(1);

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      if (finalVerification.ok) {
        attempts.push({ attempt, verification: finalVerification, repaired: false, stopped: true });
        return { ok: true, attempts, finalVerification };
      }

      const plan = finalVerification.repairPlan;
      if (!plan) {
        const entry: RepairAttempt = {
          attempt,
          verification: finalVerification,
          repaired: false,
          stopped: true,
          reason: "Verification failed without a repair plan"
        };
        attempts.push(entry);
        return { ok: false, attempts, finalVerification };
      }

      if (!plan.safeToRetry || plan.outcome === "blocked" || plan.outcome === "failed") {
        const entry: RepairAttempt = {
          attempt,
          verification: finalVerification,
          repairPlan: plan,
          repaired: false,
          stopped: true,
          reason: "Repair plan is not safe for automatic retry"
        };
        attempts.push(entry);
        return { ok: false, attempts, finalVerification };
      }

      if (attempt >= this.maxAttempts) {
        const entry: RepairAttempt = {
          attempt,
          verification: finalVerification,
          repairPlan: plan,
          repaired: false,
          stopped: true,
          reason: "Repair attempt limit reached"
        };
        attempts.push(entry);
        return { ok: false, attempts, finalVerification };
      }

      const repaired = await repair(plan, attempt);
      const entry: RepairAttempt = {
        attempt,
        verification: finalVerification,
        repairPlan: plan,
        repaired,
        stopped: !repaired,
        ...(repaired ? {} : { reason: "Repair action did not complete" })
      };
      attempts.push(entry);

      if (!repaired) return { ok: false, attempts, finalVerification };
      finalVerification = await verify(attempt + 1);
    }

    return { ok: finalVerification.ok, attempts, finalVerification };
  }
}
