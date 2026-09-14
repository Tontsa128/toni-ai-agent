import {
  RepairLoop,
  type RepairAction,
  type RepairLoopOptions,
  type RepairLoopResult,
  type VerificationAction
} from "./RepairLoop.js";
import {
  RepairSession,
  type RepairSessionOptions,
  type RepairSessionSnapshot,
  type SessionRepairAction,
  type SessionVerificationAction
} from "./RepairSession.js";
import { RepairSessionStore } from "./RepairSessionStore.js";
import { AuditLog } from "../audit/AuditLog.js";
import type { RepairPlan } from "../debug/SelfDebugger.js";
import type { VerificationResult } from "./VerificationEngine.js";

export interface RepairSessionPersistenceOptions { filePath: string; sessionId: string; }
export interface RepairAuditOptions { filePath: string; }
export interface CodingRepairCoordinatorOptions extends RepairLoopOptions {
  mode?: "legacy";
  verify: VerificationAction;
  repair: RepairAction;
}
export interface ResumableCodingRepairCoordinatorOptions extends RepairSessionOptions {
  mode: "resumable";
  verify: SessionVerificationAction;
  repair: SessionRepairAction;
  persistence?: RepairSessionPersistenceOptions;
  audit?: RepairAuditOptions;
}

export class CodingRepairCoordinator {
  private readonly loop: RepairLoop | undefined;
  private readonly loopVerify: VerificationAction | undefined;
  private readonly loopRepair: RepairAction | undefined;
  private readonly session: RepairSession | undefined;
  private readonly sessionVerify: SessionVerificationAction | undefined;
  private readonly sessionRepair: SessionRepairAction | undefined;
  private readonly sessionStore: RepairSessionStore | undefined;
  private readonly sessionId: string | undefined;
  private readonly audit: AuditLog | undefined;

  constructor(options: CodingRepairCoordinatorOptions | ResumableCodingRepairCoordinatorOptions) {
    if (options.mode === "resumable") {
      this.sessionStore = options.persistence ? new RepairSessionStore(options.persistence.filePath) : undefined;
      this.sessionId = options.persistence?.sessionId;
      this.audit = options.audit ? new AuditLog(options.audit) : undefined;
      const restored = this.sessionStore && this.sessionId ? this.sessionStore.load(this.sessionId) : undefined;
      const sessionOptions: RepairSessionOptions = {};
      if (options.maxAttempts !== undefined) sessionOptions.maxAttempts = options.maxAttempts;
      if (restored) sessionOptions.snapshot = restored;
      this.session = new RepairSession(sessionOptions);
      this.sessionVerify = options.verify;
      this.sessionRepair = options.repair;
      return;
    }
    this.loop = new RepairLoop(options);
    this.loopVerify = options.verify;
    this.loopRepair = options.repair;
  }

  async run(): Promise<RepairLoopResult> {
    if (!this.loop || !this.loopVerify || !this.loopRepair) throw new Error("This coordinator was configured for resumable repair; use start(), approve(), or reject().");
    return this.loop.run(this.loopVerify, this.loopRepair);
  }

  async start(): Promise<RepairSessionSnapshot> {
    if (!this.session || !this.sessionVerify || !this.sessionRepair) throw new Error("This coordinator is not configured for resumable repair");
    this.audit?.append({ type: "repair_started", sessionId: this.auditSessionId(), attempt: this.session.snapshot().attempt });
    const result = await this.session.start(this.sessionVerify, this.sessionRepair);
    this.persist(result);
    this.auditSnapshot(result);
    return result;
  }

  async approve(actionId: string): Promise<RepairSessionSnapshot> {
    if (!this.session) throw new Error("This coordinator is not configured for resumable repair");
    const before = this.session.snapshot();
    const result = await this.session.approve(actionId);
    this.persist(result);
    if (before.approval?.actionId === actionId) this.audit?.append({
      type: "repair_approved", sessionId: this.auditSessionId(), attempt: before.attempt, actionId
    });
    this.auditSnapshot(result);
    return result;
  }

  reject(actionId: string): RepairSessionSnapshot {
    if (!this.session) throw new Error("This coordinator is not configured for resumable repair");
    const before = this.session.snapshot();
    const result = this.session.reject(actionId);
    this.persist(result);
    if (before.approval?.actionId === actionId) this.audit?.append({
      type: "repair_rejected", sessionId: this.auditSessionId(), attempt: before.attempt, actionId
    });
    this.auditSnapshot(result);
    return result;
  }

  snapshot(): RepairSessionSnapshot {
    if (!this.session) throw new Error("This coordinator is not configured for resumable repair");
    return this.session.snapshot();
  }

  private persist(snapshot: RepairSessionSnapshot): void {
    if (!this.sessionStore || !this.sessionId) return;
    this.sessionStore.save(this.sessionId, snapshot);
  }

  private auditSessionId(): string { return this.sessionId ?? "ephemeral"; }

  private auditSnapshot(snapshot: RepairSessionSnapshot): void {
    if (!this.audit) return;
    if (snapshot.state === "waiting_approval" && snapshot.approval) this.audit.append({
      type: "repair_approval_requested", sessionId: this.auditSessionId(), attempt: snapshot.attempt,
      actionId: snapshot.approval.actionId, summary: snapshot.approval.description
    });
    if (snapshot.state === "succeeded") this.audit.append({
      type: "repair_succeeded", sessionId: this.auditSessionId(), attempt: snapshot.attempt
    });
    if (snapshot.state === "failed") this.audit.append({
      type: "repair_failed", sessionId: this.auditSessionId(), attempt: snapshot.attempt, reason: snapshot.reason
    });
  }
}

export type { RepairPlan, VerificationResult };
export { RepairSessionStore, AuditLog };
