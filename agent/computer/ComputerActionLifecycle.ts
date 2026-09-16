import type { AuditLog } from "../audit/AuditLog.js";
import type { ScreenObservation } from "../vision/ScreenObservation.js";
import type { ComputerActionRequest, ComputerActionProposal } from "./ComputerActionController.js";
import type { ComputerActionResultValidator, ComputerPostConditionExpectation, ComputerPostConditionValidation, ComputerActionValidation } from "./ComputerActionResultValidator.js";
import type { ToolExecutionResult } from "../providers/OpenAIToolLoop.js";

export interface ComputerActionLifecycleResult {
  proposal: ComputerActionProposal;
  execution: ToolExecutionResult;
  validation: ComputerActionValidation;
  postCondition?: ComputerPostConditionValidation;
}

/** Coordinates the deterministic Computer Action lifecycle without executing anything implicitly. */
export class ComputerActionLifecycle {
  constructor(
    private readonly validator: ComputerActionResultValidator,
    private readonly audit: AuditLog
  ) {}

  recordProposal(proposal: ComputerActionProposal, sessionId: string): void {
    this.audit.append({
      type: "computer_action_proposed",
      sessionId,
      actionId: proposal.actionId,
      summary: `Computer action proposed: ${proposal.action.type}`
    });
  }

  recordExecution(sessionId: string, actionId: string, execution: ToolExecutionResult): ComputerActionValidation {
    const validation = this.validator.validate(execution);
    this.audit.append({
      type: validation.status === "accepted" ? "computer_action_succeeded" : "computer_action_failed",
      sessionId,
      actionId,
      summary: "Computer action execution validated",
      reason: validation.reason
    });
    return validation;
  }

  recordPostCondition(
    sessionId: string,
    actionId: string,
    observation: ScreenObservation,
    expectation: ComputerPostConditionExpectation
  ): ComputerPostConditionValidation {
    const validation = this.validator.validatePostCondition(observation, expectation);
    this.audit.append({
      type: "computer_action_postcondition_checked",
      sessionId,
      actionId,
      summary: `Computer post-condition: ${validation.status}`,
      reason: validation.reason
    });
    return validation;
  }
}
