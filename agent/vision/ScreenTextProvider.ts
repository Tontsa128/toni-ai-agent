import type { ScreenObservation } from "./ScreenObservation.js";

export interface ScreenTextProvider {
  extractText(observation: ScreenObservation): Promise<string | undefined>;
}

export async function enrichScreenObservation(
  observation: ScreenObservation,
  provider?: ScreenTextProvider
): Promise<ScreenObservation> {
  if (!provider || !observation.imageDataUrl) return observation;
  const text = await provider.extractText(observation);
  if (!text?.trim()) return observation;
  return { ...observation, visibleText: text.trim() };
}
