import { RepairLoop, type RepairAction, type RepairLoopOptions, type RepairLoopResult, type VerificationAction } from "./RepairLoop.js";
import { RepairSession, type RepairSessionOptions, type RepairSessionSnapshot, type SessionRepairAction, type SessionVerificationAction } from "./RepairSession.js";
import type { RepairPlan } from "../debug/SelfDebugger.js";
import type { VerificationResult } from "./VerificationEngine.js";

export interface CodingRepairCoordinatorOptions extends RepairLoopOptions {
  verify: VerificationAction;
  repair: RepairAction;
}

export interface ResumableCodingRepairCoordinatorOptions extends RepairSessionOptions {
  verify: SessionVerificationAction;
  repair: SessionRepairAction;
}

/**
 * Binds the generic bounded RepairLoop to the coding workflow.
 * The legacy run() API remains available for non-approval repair callbacks.
 */
export class CodingRepairCoordinator {
  private readonly loop?: RepairLoop;
  private readonly session?: RepairSession;

  constructor(options: CodingRepairCoordinatorOptions | ResumableCodingRepairCoordinatorOptions) {
    if ("maxAttempts" in options && options.maxAttempts !== undefined) {
      // The session/loop both enforce the hard three-attempt ceiling.
    }
    if ("verify" in options && "repair" in options) {
      if (options.repair.length >= 3) {
        this.session = new RepairSession(options);
      } else {
        this.loop = new RepairLoop(options);
      }
    }
  }

  async run(): Promise<RepairLoopResult> {
    if (!this.loop) {
      throw new Error("This coordinator was configured for resumable repair; use start(), approve(), or reject().");
    }
    return this.loop.run(this.loopVerify!, this.loopRepair!);
  }

  private get loopVerify(): VerificationAction | undefined {
    return (this as unknown as { loopVerify?: VerificationAction }).loopVerify;
  }

  private get loopRepair(): RepairAction | undefined {
    return (this as unknown as { loopRepair?: RepairAction }).loopRepair;
  }

  async start(): Promise<RepairSessionSnapshot> {
    if (!this.session) throw new Error("This coordinator is not configured for resumable repair");
    return this.session.start(this.sessionVerify!, this.sessionRepair!);
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

  private get sessionVerify(): SessionVerificationAction | undefined {
    return (this as unknown as { sessionVerify?: SessionVerificationAction }).sessionVerify;
  }

  private get sessionRepair(): SessionRepairAction | undefined {
    return (this as unknown as { sessionRepair?: SessionRepairAction }).sessionRepair;
  }
}

export type { RepairPlan, VerificationResult };
