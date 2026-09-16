import { randomUUID } from "node:crypto";
import type { ScreenObservation } from "../vision/ScreenObservation.js";
import { SupervisedToolExecutor } from "../core/SupervisedToolExecutor.js";
import type { ToolExecutionContext, ToolExecutionResult } from "../providers/OpenAIToolLoop.js";
import { ComputerActionResultValidator, type ComputerActionValidation } from "./ComputerActionResultValidator.js";

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

export interface ComputerActionExecution {
  result: ToolExecutionResult;
  validation: ComputerActionValidation;
}

/** Converts a privacy-filtered observation into an approval-gated computer action. */
export class ComputerActionController {
  constructor(
    private readonly executor: SupervisedToolExecutor,
    private readonly validator = new ComputerActionResultValidator()
  ) {}

  async proposeAndQueue(
    observation: ScreenObservation,
    action: ComputerActionRequest
  ): Promise<{ proposal?: ComputerActionProposal; result: ToolExecutionResult }> {
    if (observation.imageDataUrl) {
      return { result: { ok: false, approved: false, output: { error: "Computer actions require a privacy-filtered observation." } } };
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

  async approve(actionId: string): Promise<ComputerActionExecution> {
    const result = await this.executor.approveAndResume(actionId);
    return { result, validation: this.validator.validate(result) };
  }

  reject(actionId: string): void {
    this.executor.reject(actionId);
  }

  private toToolCall(action: ComputerActionRequest): ToolExecutionContext {
    switch (action.type) {
      case "click": return { callId: randomUUID(), name: "computer_click", argumentsJson: JSON.stringify({ x: action.x, y: action.y }) };
      case "type": return { callId: randomUUID(), name: "computer_type", argumentsJson: JSON.stringify({ text: action.text }) };
      case "keypress": return { callId: randomUUID(), name: "computer_keypress", argumentsJson: JSON.stringify({ key: action.key }) };
    }
  }
}
