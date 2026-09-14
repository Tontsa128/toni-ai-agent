import type { RepairPlan } from "../debug/SelfDebugger.js";
import type { VerificationResult } from "./VerificationEngine.js";

export type RepairSessionState =
  | "verifying"
  | "needs_repair"
  | "waiting_approval"
  | "repairing"
  | "succeeded"
  | "failed"
  | "rejected";

export interface RepairApprovalRequest {
  actionId: string;
  attempt: number;
  description: string;
}

export type SessionRepairResult =
  | { status: "repaired" }
  | { status: "approval_required"; actionId: string; description: string }
  | { status: "failed"; reason: string };

export type SessionRepairAction = (
  plan: RepairPlan,
  attempt: number,
  approved: boolean
) => Promise<SessionRepairResult>;
export type SessionVerificationAction = (attempt: number) => Promise<VerificationResult>;

export interface RepairSessionOptions {
  maxAttempts?: number;
}

export interface RepairSessionSnapshot {
  state: RepairSessionState;
  attempt: number;
  verification?: VerificationResult;
  repairPlan?: RepairPlan;
  approval?: RepairApprovalRequest;
  reason?: string;
}

/**
 * Resumable bounded repair state machine. Approval pauses the session without
 * losing the current attempt or repair plan. Approval resumes the exact pending
 * repair once; rejection terminates the session safely.
 */
export class RepairSession {
  private readonly maxAttempts: number;
  private state: RepairSessionState = "verifying";
  private attempt = 1;
  private verification: VerificationResult | undefined;
  private repairPlan: RepairPlan | undefined;
  private approval: RepairApprovalRequest | undefined;
  private reason: string | undefined;
  private repairAction: SessionRepairAction | undefined;
  private verifyAction: SessionVerificationAction | undefined;
  private repairInFlight = false;

  constructor(options: RepairSessionOptions = {}) {
    this.maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 3, 3));
  }

  snapshot(): RepairSessionSnapshot {
    const snapshot: RepairSessionSnapshot = {
      state: this.state,
      attempt: this.attempt
    };
    if (this.verification !== undefined) snapshot.verification = this.verification;
    if (this.repairPlan !== undefined) snapshot.repairPlan = this.repairPlan;
    if (this.approval !== undefined) snapshot.approval = this.approval;
    if (this.reason !== undefined) snapshot.reason = this.reason;
    return snapshot;
  }

  async start(
    verify: SessionVerificationAction,
    repair: SessionRepairAction
  ): Promise<RepairSessionSnapshot> {
    if (this.state !== "verifying") return this.snapshot();
    this.verifyAction = verify;
    this.repairAction = repair;
    await this.verifyCurrent();
    return this.snapshot();
  }

  async approve(actionId: string): Promise<RepairSessionSnapshot> {
    if (this.state !== "waiting_approval" || !this.approval || this.approval.actionId !== actionId) {
      return this.snapshot();
    }
    if (!this.repairPlan || !this.repairAction) return this.fail("Pending repair is unavailable");
    if (this.repairInFlight) return this.snapshot();

    this.repairInFlight = true;
    this.state = "repairing";
    let result: SessionRepairResult;
    try {
      result = await this.repairAction(this.repairPlan, this.attempt, true);
    } catch (error) {
      result = {
        status: "failed",
        reason: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.repairInFlight = false;
    }

    return this.handleRepairResult(result);
  }

  reject(actionId: string): RepairSessionSnapshot {
    if (this.state === "waiting_approval" && this.approval?.actionId === actionId) {
      this.state = "rejected";
      this.reason = "Repair approval rejected";
      this.approval = undefined;
    }
    return this.snapshot();
  }

  private async verifyCurrent(): Promise<void> {
    if (!this.verifyAction) return;
    this.state = "verifying";
    this.verification = await this.verifyAction(this.attempt);

    if (this.verification.ok) {
      this.state = "succeeded";
      return;
    }

    this.repairPlan = this.verification.repairPlan;
    if (!this.repairPlan) {
      this.fail("Verification failed without a repair plan");
      return;
    }
    if (!this.repairPlan.safeToRetry || this.repairPlan.outcome === "blocked" || this.repairPlan.outcome === "failed") {
      this.fail("Repair plan is not safe for automatic retry");
      return;
    }
    if (this.attempt >= this.maxAttempts) {
      this.fail("Repair attempt limit reached");
      return;
    }

    this.state = "needs_repair";
    await this.requestOrRepair();
  }

  private async requestOrRepair(): Promise<void> {
    if (!this.repairPlan || !this.repairAction || this.repairInFlight) return;
    this.repairInFlight = true;
    this.state = "repairing";
    let result: SessionRepairResult;
    try {
      result = await this.repairAction(this.repairPlan, this.attempt, false);
    } catch (error) {
      result = {
        status: "failed",
        reason: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.repairInFlight = false;
    }

    await this.handleRepairResult(result);
  }

  private async handleRepairResult(result: SessionRepairResult): Promise<RepairSessionSnapshot> {
    if (result.status === "approval_required") {
      this.state = "waiting_approval";
      this.approval = {
        actionId: result.actionId,
        attempt: this.attempt,
        description: result.description
      };
      return this.snapshot();
    }

    if (result.status === "failed") return this.fail(result.reason);

    this.approval = undefined;
    this.repairPlan = undefined;
    this.attempt += 1;
    await this.verifyCurrent();
    return this.snapshot();
  }

  private fail(reason: string): RepairSessionSnapshot {
    this.state = "failed";
    this.reason = reason;
    this.approval = undefined;
    this.repairPlan = undefined;
    return this.snapshot();
  }
}
