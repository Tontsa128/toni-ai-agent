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
import type { RepairPlan } from "../debug/SelfDebugger.js";
import type { VerificationResult } from "./VerificationEngine.js";

export interface CodingRepairCoordinatorOptions extends RepairLoopOptions {
  mode?: "legacy";
  verify: VerificationAction;
  repair: RepairAction;
}

export interface ResumableCodingRepairCoordinatorOptions extends RepairSessionOptions {
  mode: "resumable";
  verify: SessionVerificationAction;
  repair: SessionRepairAction;
}

export class CodingRepairCoordinator {
  private readonly loop: RepairLoop | undefined;
  private readonly loopVerify: VerificationAction | undefined;
  private readonly loopRepair: RepairAction | undefined;
  private readonly session: RepairSession | undefined;
  private readonly sessionVerify: SessionVerificationAction | undefined;
  private readonly sessionRepair: SessionRepairAction | undefined;

  constructor(options: CodingRepairCoordinatorOptions | ResumableCodingRepairCoordinatorOptions) {
    if (options.mode === "resumable") {
      this.session = new RepairSession(options);
      this.sessionVerify = options.verify;
      this.sessionRepair = options.repair;
      return;
    }

    this.loop = new RepairLoop(options);
    this.loopVerify = options.verify;
    this.loopRepair = options.repair;
  }

  async run(): Promise<RepairLoopResult> {
    if (!this.loop || !this.loopVerify || !this.loopRepair) {
      throw new Error("This coordinator was configured for resumable repair; use start(), approve(), or reject().");
    }
    return this.loop.run(this.loopVerify, this.loopRepair);
  }

  async start(): Promise<RepairSessionSnapshot> {
    if (!this.session || !this.sessionVerify || !this.sessionRepair) {
      throw new Error("This coordinator is not configured for resumable repair");
    }
    return this.session.start(this.sessionVerify, this.sessionRepair);
  }

  async approve(actionId: string): Promise<RepairSessionSnapshot> {
    if (!this.session) throw new Error("This coordinator is not configured for resumable repair");
    return this.session.approve(actionId);
  }

  reject(actionId: string): RepairSessionSnapshot {
    if (!this.session) throw new Error("This coordinator is not configured for resumable repair");
    return this.session.reject(actionId);
  }

  snapshot(): RepairSessionSnapshot {
    if (!this.session) throw new Error("This coordinator is not configured for resumable repair");
    return this.session.snapshot();
  }
}

export type { RepairPlan, VerificationResult };
