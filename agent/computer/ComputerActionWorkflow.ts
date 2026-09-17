import type { ScreenObservation } from "../vision/ScreenObservation.js";
import type { ComputerActionController, ComputerActionRequest, ComputerActionProposal, ComputerActionExecution } from "./ComputerActionController.js";
import type { ComputerActionLifecycle } from "./ComputerActionLifecycle.js";
import type { ComputerPostConditionExpectation, ComputerPostConditionValidation } from "./ComputerActionResultValidator.js";

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
}

/**
 * Coordinates the supervised computer-action lifecycle without ever bypassing approval.
 * Verification always uses a fresh observation captured after the approved execution.
 */
export class ComputerActionWorkflow {
  constructor(
    private readonly controller: ComputerActionController,
    private readonly lifecycle: ComputerActionLifecycle,
    private readonly observations: ScreenObservationProvider
  ) {}

  async propose(
    observation: ScreenObservation,
    action: ComputerActionRequest,
    sessionId: string
  ): Promise<ComputerActionWorkflowQueued> {
    const queued = await this.controller.proposeAndQueue(observation, action);
    if (!queued.proposal || !queued.proposal.actionId) {
      throw new Error("Computer action was not queued for supervised approval.");
    }
    this.lifecycle.recordProposal(queued.proposal, sessionId);
    return { proposal: queued.proposal, queuedResult: queued.result };
  }

  async approveAndVerify(
    actionId: string,
    sessionId: string,
    expectation?: ComputerPostConditionExpectation
  ): Promise<ComputerActionWorkflowExecution> {
    const execution = await this.controller.approve(actionId);
    const validation = this.lifecycle.recordExecution(sessionId, actionId, execution.result);

    if (validation.status !== "accepted") {
      return { queued: this.requireQueued(actionId), execution };
    }

    const freshObservation = await this.observations.capture();
    const postCondition = expectation === undefined
      ? undefined
      : this.lifecycle.recordPostCondition(sessionId, actionId, freshObservation, expectation);

    return { queued: this.requireQueued(actionId), execution, ...(postCondition ? { postCondition } : {}) };
  }

  reject(actionId: string, sessionId: string): void {
    this.controller.reject(actionId);
    this.lifecycle.recordRejection(sessionId, actionId);
  }

  private queuedByActionId = new Map<string, ComputerActionWorkflowQueued>();

  private requireQueued(actionId: string): ComputerActionWorkflowQueued {
    const queued = this.queuedByActionId.get(actionId);
    if (!queued) throw new Error(`Unknown computer action: ${actionId}`);
    return queued;
  }

  private remember(queued: ComputerActionWorkflowQueued): ComputerActionWorkflowQueued {
    this.queuedByActionId.set(queued.proposal.actionId!, queued);
    return queued;
  }
}
