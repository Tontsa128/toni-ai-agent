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
import type { RepairPlan } from "../debug/SelfDebugger.js";
import type { VerificationResult } from "./VerificationEngine.js";

export interface RepairSessionPersistenceOptions { filePath: string; sessionId: string; }
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

  constructor(options: CodingRepairCoordinatorOptions | ResumableCodingRepairCoordinatorOptions) {
    if (options.mode === "resumable") {
      this.sessionStore = options.persistence ? new RepairSessionStore(options.persistence.filePath) : undefined;
      this.sessionId = options.persistence?.sessionId;
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
    const result = await this.session.start(this.sessionVerify, this.sessionRepair);
    this.persist(result);
    return result;
  }

  async approve(actionId: string): Promise<RepairSessionSnapshot> {
    if (!this.session) throw new Error("This coordinator is not configured for resumable repair");
    const result = await this.session.approve(actionId);
    this.persist(result);
    return result;
  }

  reject(actionId: string): RepairSessionSnapshot {
    if (!this.session) throw new Error("This coordinator is not configured for resumable repair");
    const result = this.session.reject(actionId);
    this.persist(result);
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
}

export type { RepairPlan, VerificationResult };
export { RepairSessionStore };
