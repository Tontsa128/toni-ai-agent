import type { ScreenSuggestion } from "./ScreenContextAssistant.js";

export interface ScreenSuggestionDecision {
  suggestion: ScreenSuggestion;
  key: string;
}

/** Prevents the same proactive suggestion from appearing on every screen poll. */
export class ScreenSuggestionDebouncer {
  private lastKey: string | undefined;
  private lastShownAt = 0;

  constructor(private readonly cooldownMs = 60_000) {}

  shouldShow(suggestion: ScreenSuggestion, contextKey: string): boolean {
    const key = `${suggestion.kind}:${suggestion.action}:${contextKey}`;
    const now = Date.now();
    if (key === this.lastKey && now - this.lastShownAt < this.cooldownMs) return false;
    this.lastKey = key;
    this.lastShownAt = now;
    return true;
  }

  reset(): void {
    this.lastKey = undefined;
    this.lastShownAt = 0;
  }
}
