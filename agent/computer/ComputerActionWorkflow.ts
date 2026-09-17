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

/** Coordinates supervised computer actions; approval remains authoritative and verification uses a fresh observation. */
export class ComputerActionWorkflow {
  private readonly queuedActions = new Map<string, ComputerActionWorkflowQueued>();

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
    if (!queued.proposal?.actionId) {
      throw new Error("Computer action was not queued for supervised approval.");
    }
    this.lifecycle.recordProposal(queued.proposal, sessionId);
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
    const validation = this.lifecycle.recordExecution(sessionId, actionId, execution.result);

    if (validation.status !== "accepted") return { queued, execution };

    const freshObservation = await this.observations.capture();
    const postCondition = expectation === undefined
      ? undefined
      : this.lifecycle.recordPostCondition(sessionId, actionId, freshObservation, expectation);

    return { queued, execution, ...(postCondition ? { postCondition } : {}) };
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
