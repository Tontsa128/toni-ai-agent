import type { ScreenObservation } from "./ScreenObservation.js";

export interface ScreenPrivacyFilterOptions {
  blockedWindowSignals?: string[];
  blockedTextSignals?: string[];
}

/** Removes obvious credential/private-content signals before an observation is passed onward. */
export class ScreenPrivacyFilter {
  private readonly blockedWindowSignals: string[];
  private readonly blockedTextSignals: string[];

  constructor(options: ScreenPrivacyFilterOptions = {}) {
    this.blockedWindowSignals = (options.blockedWindowSignals ?? [
      "password", "salasana", "credential", "credentials", "login", "kirjautuminen",
      "bank", "pankki", "payment", "maksu", "private", "yksityinen", "incognito"
    ]).map((value) => value.toLocaleLowerCase("fi-FI"));
    this.blockedTextSignals = (options.blockedTextSignals ?? [
      "password", "salasana", "api key", "apikey", "access token", "refresh token",
      "authorization: bearer", "mfa", "otp", "verification code", "vahvistuskoodi"
    ]).map((value) => value.toLocaleLowerCase("fi-FI"));
  }

  shouldBlock(observation: ScreenObservation): boolean {
    const windowText = [observation.activeWindowTitle ?? "", observation.activeApplication ?? ""]
      .join(" ").toLocaleLowerCase("fi-FI");
    if (this.blockedWindowSignals.some((signal) => windowText.includes(signal))) return true;

    const visibleText = (observation.visibleText ?? "").toLocaleLowerCase("fi-FI");
    return this.blockedTextSignals.some((signal) => visibleText.includes(signal));
  }

  filter(observation: ScreenObservation): ScreenObservation | undefined {
    if (this.shouldBlock(observation)) return undefined;
    return {
      ...observation,
      imageDataUrl: undefined
    };
  }
}
