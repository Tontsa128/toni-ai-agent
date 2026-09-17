import type { AuditLog } from "../audit/AuditLog.js";
import type { ScreenObservation } from "../vision/ScreenObservation.js";
import type { ComputerActionProposal } from "./ComputerActionController.js";
import type {
  ComputerActionResultValidator,
  ComputerPostConditionExpectation,
  ComputerPostConditionValidation,
  ComputerActionValidation
} from "./ComputerActionResultValidator.js";
import type { ToolExecutionResult } from "../providers/OpenAIToolLoop.js";

export interface ComputerActionLifecycleResult {
  proposal: ComputerActionProposal;
  execution: ToolExecutionResult;
  validation: ComputerActionValidation;
  postCondition?: ComputerPostConditionValidation;
}

/** Records the deterministic Computer Action lifecycle; it never executes actions implicitly. */
export class ComputerActionLifecycle {
  private readonly observationBaselines = new Map<string, string>();

  constructor(
    private readonly validator: ComputerActionResultValidator,
    private readonly audit: AuditLog
  ) {}

  recordProposal(proposal: ComputerActionProposal, sessionId: string): void {
    const event: Parameters<AuditLog["append"]>[0] = {
      type: "computer_action_proposed",
      sessionId,
      summary: `Computer action proposed: ${proposal.action.type}`
    };
    if (proposal.actionId !== undefined) {
      event.actionId = proposal.actionId;
      this.observationBaselines.set(proposal.actionId, proposal.observationCapturedAt);
    }
    this.audit.append(event);
  }

  recordApprovalRequested(sessionId: string, actionId: string): void {
    this.audit.append({
      type: "computer_action_approval_requested",
      sessionId,
      actionId,
      summary: "Human approval requested for computer action"
    });
  }

  recordApproval(sessionId: string, actionId: string): void {
    this.audit.append({
      type: "computer_action_approved",
      sessionId,
      actionId,
      summary: "Human approval granted for computer action"
    });
  }

  recordRejection(sessionId: string, actionId: string): void {
    this.audit.append({
      type: "computer_action_rejected",
      sessionId,
      actionId,
      summary: "Human rejected computer action"
    });
  }

  recordExecution(sessionId: string, actionId: string, execution: ToolExecutionResult): ComputerActionValidation {
    const validation = this.validator.validate(execution);
    this.audit.append({
      type: validation.status === "accepted" ? "computer_action_executed" : "computer_action_execution_failed",
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
    const baseline = this.observationBaselines.get(actionId);
    const effectiveExpectation = baseline === undefined || expectation.observationCapturedAfter !== undefined
      ? expectation
      : { ...expectation, observationCapturedAfter: baseline };
    const validation = this.validator.validatePostCondition(observation, effectiveExpectation);
    const type = validation.status === "confirmed"
      ? "computer_action_verification_confirmed"
      : validation.status === "not_confirmed"
        ? "computer_action_verification_failed"
        : "computer_action_verification_inconclusive";
    this.audit.append({
      type,
      sessionId,
      actionId,
      summary: `Computer post-condition: ${validation.status}`,
      reason: validation.reason
    });
    return validation;
  }
}
