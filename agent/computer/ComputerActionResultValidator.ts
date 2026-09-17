import type { ToolExecutionResult } from "../providers/OpenAIToolLoop.js";
import type { ScreenObservation } from "../vision/ScreenObservation.js";

export type ComputerValidationStatus = "accepted" | "failed";
export type PostConditionStatus = "confirmed" | "not_confirmed" | "inconclusive";

export interface ComputerActionValidation {
  status: ComputerValidationStatus;
  reason: string;
}

export interface ComputerPostConditionExpectation {
  activeWindowTitleIncludes?: string;
  activeApplicationIncludes?: string;
  visibleTextIncludes?: string[];
  visibleTextExcludes?: string[];
  /** When supplied, the observation must have been captured strictly after the action baseline. */
  observationCapturedAfter?: string;
}

export interface ComputerPostConditionValidation {
  status: PostConditionStatus;
  reason: string;
}

/**
 * Validates supervisor/adapter execution separately from visual post-condition checks.
 * A successful adapter result never implies that the requested UI state actually changed.
 */
export class ComputerActionResultValidator {
  validate(result: ToolExecutionResult): ComputerActionValidation {
    if (!result.ok) return { status: "failed", reason: "Computer adapter reported an execution failure." };
    if (result.approved !== true) return { status: "failed", reason: "Computer execution was not explicitly approved." };
    if (result.output === undefined || result.output === null) return { status: "failed", reason: "Computer adapter returned no execution result." };
    return { status: "accepted", reason: "Computer adapter execution result passed structural validation." };
  }

  validatePostCondition(
    observation: ScreenObservation,
    expectation: ComputerPostConditionExpectation
  ): ComputerPostConditionValidation {
    if (observation.imageDataUrl) {
      return { status: "inconclusive", reason: "Raw screen observations must be privacy-filtered before post-condition validation." };
    }

    if (expectation.observationCapturedAfter !== undefined) {
      const baseline = Date.parse(expectation.observationCapturedAfter);
      const captured = Date.parse(observation.capturedAt);
      if (!Number.isFinite(baseline) || !Number.isFinite(captured)) {
        return { status: "inconclusive", reason: "Post-condition freshness check requires valid observation timestamps." };
      }
      if (captured <= baseline) {
        return { status: "inconclusive", reason: "Post-condition observation was not captured after the action baseline." };
      }
    }

    const checks: boolean[] = [];
    if (expectation.activeWindowTitleIncludes !== undefined) {
      const title = observation.activeWindowTitle?.toLocaleLowerCase("fi-FI");
      checks.push(title?.includes(expectation.activeWindowTitleIncludes.toLocaleLowerCase("fi-FI")) === true);
    }
    if (expectation.activeApplicationIncludes !== undefined) {
      const app = observation.activeApplication?.toLocaleLowerCase("fi-FI");
      checks.push(app?.includes(expectation.activeApplicationIncludes.toLocaleLowerCase("fi-FI")) === true);
    }
    const text = observation.visibleText?.toLocaleLowerCase("fi-FI");
    if (expectation.visibleTextIncludes !== undefined) {
      if (text === undefined) {
        return { status: "inconclusive", reason: "Post-condition requires OCR text, but no visible text is available." };
      }
      for (const expected of expectation.visibleTextIncludes) checks.push(text.includes(expected.toLocaleLowerCase("fi-FI")));
    }
    if (expectation.visibleTextExcludes !== undefined) {
      if (text === undefined) {
        return { status: "inconclusive", reason: "Post-condition requires OCR text, but no visible text is available." };
      }
      for (const forbidden of expectation.visibleTextExcludes) checks.push(!text.includes(forbidden.toLocaleLowerCase("fi-FI")));
    }

    if (checks.length === 0) return { status: "inconclusive", reason: "No observable post-condition was supplied." };
    if (checks.every(Boolean)) return { status: "confirmed", reason: "The new screen observation satisfies all supplied post-condition checks." };
    return { status: "not_confirmed", reason: "The new screen observation does not satisfy all supplied post-condition checks." };
  }
}
