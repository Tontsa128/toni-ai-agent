import type { ScreenObservation } from "../vision/ScreenObservation.js";
import { SupervisedToolExecutor } from "../core/SupervisedToolExecutor.js";
import type { ToolExecutionResult } from "../providers/OpenAIToolLoop.js";

export type ComputerActionRequest =
  | { type: "click"; x: number; y: number }
  | { type: "type"; text: string }
  | { type: "keypress"; key: string };

export interface ComputerActionProposal {
  action: ComputerActionRequest;
  observationCapturedAt: string;
  activeWindowTitle?: string;
  activeApplication?: string;
}

/**
 * Converts a privacy-filtered screen observation into an approval-gated computer action.
 * This controller never calls the OS adapter directly: every action crosses the existing
 * SupervisedToolExecutor and PermissionEngine boundary.
 */
export class ComputerActionController {
  constructor(private readonly executor: SupervisedToolExecutor) {}

  async proposeAndQueue(
    observation: ScreenObservation,
    action: ComputerActionRequest
  ): Promise<{ proposal?: ComputerActionProposal; result: ToolExecutionResult }> {
    if (observation.imageDataUrl) {
      return {
        result: {
          ok: false,
          approved: false,
          output: { error: "Computer actions require a privacy-filtered observation." }
        }
      };
    }

    const proposal: ComputerActionProposal = {
      action: { ...action },
      observationCapturedAt: observation.capturedAt,
      ...(observation.activeWindowTitle ? { activeWindowTitle: observation.activeWindowTitle } : {}),
      ...(observation.activeApplication ? { activeApplication: observation.activeApplication } : {})
    };

    const result = await this.executor.execute(this.toToolCall(action));
    return { proposal, result };
  }

  approve(actionId: string): Promise<ToolExecutionResult> {
    return this.executor.approveAndResume(actionId);
  }

  reject(actionId: string): void {
    this.executor.reject(actionId);
  }

  private toToolCall(action: ComputerActionRequest) {
    switch (action.type) {
      case "click":
        return { name: "computer_click", argumentsJson: JSON.stringify({ x: action.x, y: action.y }) };
      case "type":
        return { name: "computer_type", argumentsJson: JSON.stringify({ text: action.text }) };
      case "keypress":
        return { name: "computer_keypress", argumentsJson: JSON.stringify({ key: action.key }) };
    }
  }
}
