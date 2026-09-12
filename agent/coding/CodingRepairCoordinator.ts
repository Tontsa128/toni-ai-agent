import { RepairLoop, type RepairAction, type RepairLoopOptions, type RepairLoopResult, type VerificationAction } from "./RepairLoop.js";
import type { RepairPlan } from "../debug/SelfDebugger.js";
import type { VerificationResult } from "./VerificationEngine.js";

export interface CodingRepairCoordinatorOptions extends RepairLoopOptions {
  verify: VerificationAction;
  repair: RepairAction;
}

/**
 * Binds the generic bounded RepairLoop to the coding workflow.
 *
 * The coordinator intentionally receives verification and repair callbacks from the
 * host application. This keeps shell execution and file mutation behind the existing
 * supervised executor/approval boundary instead of embedding privileged operations here.
 */
export class CodingRepairCoordinator {
  private readonly loop: RepairLoop;
  private readonly verify: VerificationAction;
  private readonly repair: RepairAction;

  constructor(options: CodingRepairCoordinatorOptions) {
    this.loop = new RepairLoop(options);
    this.verify = options.verify;
    this.repair = options.repair;
  }

  async run(): Promise<RepairLoopResult> {
    return this.loop.run(this.verify, this.repair);
  }
}

export type { RepairPlan, VerificationResult };
