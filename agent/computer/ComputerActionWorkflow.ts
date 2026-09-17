import type { ScreenObservation } from "../vision/ScreenObservation.js";
import type { ComputerActionController, ComputerActionRequest, ComputerActionProposal, ComputerActionExecution } from "./ComputerActionController.js";
import type { ComputerActionLifecycle } from "./ComputerActionLifecycle.js";
import type { ComputerPostConditionExpectation, ComputerPostConditionValidation } from "./ComputerActionResultValidator.js";
import type { ComputerVerificationPolicy } from "./ComputerVerificationPolicy.js";

export interface ScreenObservationProvider {
  capture(): Promise<ScreenObservation>;
}

export interface ComputerActionWorkflowQueued {
  proposal: ComputerActionProposal;
  queuedResult: ComputerActionExecution["result"];
}

export interface ComputerActionWorkflowExecution {
  queued: ComputerActionWorkflowQueued;
  execution: ComputerActionExecution;
  postCondition?: ComputerPostConditionValidation;
  verificationAttempts: number;
}

/** Coordinates supervised computer actions; approval remains authoritative and verification uses fresh observations. */
export class ComputerActionWorkflow {
  private readonly queuedActions = new Map<string, ComputerActionWorkflowQueued>();

  constructor(
    private readonly controller: ComputerActionController,
    private readonly lifecycle: ComputerActionLifecycle,
    private readonly observations: ScreenObservationProvider,
    private readonly verificationPolicy?: ComputerVerificationPolicy
  ) {}

  async propose(
    observation: ScreenObservation,
    action: ComputerActionRequest,
    sessionId: string
  ): Promise<ComputerActionWorkflowQueued> {
    const queued = await this.controller.proposeAndQueue(observation, action);
    if (!queued.proposal?.actionId) throw new Error("Computer action was not queued for supervised approval.");
    this.lifecycle.recordProposal(queued.proposal, sessionId);
    this.lifecycle.recordApprovalRequested(sessionId, queued.proposal.actionId);
    const result = { proposal: queued.proposal, queuedResult: queued.result };
    this.queuedActions.set(queued.proposal.actionId, result);
    return result;
  }

  async approveAndVerify(
    actionId: string,
    sessionId: string,
    expectation?: ComputerPostConditionExpectation
  ): Promise<ComputerActionWorkflowExecution> {
    const queued = this.requireQueued(actionId);
    const execution = await this.controller.approve(actionId);
    if (execution.result.approved === true) this.lifecycle.recordApproval(sessionId, actionId);
    const validation = this.lifecycle.recordExecution(sessionId, actionId, execution.result);
    if (validation.status !== "accepted") return { queued, execution, verificationAttempts: 0 };
    if (expectation === undefined) return { queued, execution, verificationAttempts: 0 };

    const policy = this.verificationPolicy;
    let attempts = 0;
    while (true) {
      attempts += 1;
      const freshObservation = await this.observations.capture();
      const postCondition = this.lifecycle.recordPostCondition(sessionId, actionId, freshObservation, expectation);
      if (!policy || policy.decide(postCondition, attempts) !== "observe_again") {
        return { queued, execution, postCondition, verificationAttempts: attempts };
      }
    }
  }

  reject(actionId: string, sessionId: string): void {
    this.requireQueued(actionId);
    this.controller.reject(actionId);
    this.lifecycle.recordRejection(sessionId, actionId);
    this.queuedActions.delete(actionId);
  }

  private requireQueued(actionId: string): ComputerActionWorkflowQueued {
    const queued = this.queuedActions.get(actionId);
    if (!queued) throw new Error(`Unknown computer action: ${actionId}`);
    return queued;
  }
}
