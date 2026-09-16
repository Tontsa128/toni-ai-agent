import type { ToolExecutionResult } from "../providers/OpenAIToolLoop.js";

export type ComputerValidationStatus = "accepted" | "failed";

export interface ComputerActionValidation {
  status: ComputerValidationStatus;
  reason: string;
}

/**
 * Validates the supervisor/adapter result before the computer action is reported as successful.
 * Visual post-condition checking belongs to a later observation pass and is never inferred here.
 */
export class ComputerActionResultValidator {
  validate(result: ToolExecutionResult): ComputerActionValidation {
    if (!result.ok) return { status: "failed", reason: "Computer adapter reported an execution failure." };
    if (result.approved !== true) return { status: "failed", reason: "Computer execution was not explicitly approved." };
    if (result.output === undefined || result.output === null) return { status: "failed", reason: "Computer adapter returned no execution result." };
    return { status: "accepted", reason: "Computer adapter execution result passed structural validation." };
  }
}
