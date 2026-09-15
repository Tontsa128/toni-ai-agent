import type { ScreenSuggestion } from "./ScreenContextAssistant.js";

export type ScreenSuggestionDecision = "idle" | "accepted" | "dismissed";

export interface ScreenSuggestionState {
  suggestion?: ScreenSuggestion;
  decision: ScreenSuggestionDecision;
}

/** Keeps proactive UI decisions separate from the screen-capture pipeline. */
export class ScreenSuggestionController {
  private state: ScreenSuggestionState = { decision: "idle" };

  publish(suggestion: ScreenSuggestion): ScreenSuggestionState {
    this.state = { suggestion, decision: "idle" };
    return this.getState();
  }

  accept(): ScreenSuggestionState {
    if (!this.state.suggestion) return this.getState();
    this.state = { ...this.state, decision: "accepted" };
    return this.getState();
  }

  dismiss(): ScreenSuggestionState {
    if (!this.state.suggestion) return this.getState();
    this.state = { ...this.state, decision: "dismissed" };
    return this.getState();
  }

  clear(): void {
    this.state = { decision: "idle" };
  }

  getState(): ScreenSuggestionState {
    return {
      decision: this.state.decision,
      ...(this.state.suggestion ? { suggestion: { ...this.state.suggestion } } : {})
    };
  }
}
