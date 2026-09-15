import type { ScreenObservation } from "./ScreenObservation.js";
import { ScreenPrivacyFilter } from "./ScreenPrivacyFilter.js";
import { enrichScreenObservation, type ScreenTextProvider } from "./ScreenTextProvider.js";

export interface ScreenOcrPipelineResult {
  observation?: ScreenObservation;
  privacyBlocked: boolean;
}

export class ScreenOcrPipeline {
  constructor(private readonly privacyFilter: ScreenPrivacyFilter, private readonly textProvider?: ScreenTextProvider) {}

  async process(observation: ScreenObservation): Promise<ScreenOcrPipelineResult> {
    if (this.privacyFilter.shouldBlock(observation)) return { privacyBlocked: true };
    let enriched = observation;
    try { enriched = await enrichScreenObservation(observation, this.textProvider); } catch { enriched = observation; }
    const safeObservation = this.privacyFilter.filter(enriched);
    if (!safeObservation) return { privacyBlocked: true };
    return { observation: safeObservation, privacyBlocked: false };
  }
}
