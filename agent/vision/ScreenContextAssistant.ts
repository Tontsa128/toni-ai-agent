import type { ScreenObservation } from "./ScreenObservation.js";

export type ScreenContextKind = "school" | "business" | "coding" | "general";

export interface ScreenSuggestion {
  kind: ScreenContextKind;
  title: string;
  message: string;
  action: string;
  confidence: number;
}

const studySignals = [
  "tehtävä", "tehtävänanto", "oppimistehtävä", "liiketoiminta", "liiketoimintasuunnitelma",
  "business plan", "kurssi", "oppitunti", "raportti", "essee", "suunnitelma", "osaamistavoite"
];

function normalize(value: string): string {
  return value.toLocaleLowerCase("fi-FI");
}

/**
 * Produces short, non-intrusive suggestions from already-authorized screen
 * observations. It never performs the suggested action itself.
 */
export class ScreenContextAssistant {
  analyse(observation: ScreenObservation): ScreenSuggestion | undefined {
    const text = normalize([observation.activeWindowTitle ?? "", observation.activeApplication ?? "", observation.visibleText ?? ""].join(" "));
    const matches = studySignals.filter((signal) => text.includes(signal)).length;
    if (matches === 0) return undefined;

    const confidence = Math.min(0.99, 0.55 + matches * 0.08);
    return {
      kind: "school",
      title: "Näyttää siltä, että olet koulutehtävässä",
      message: "Haluatko, että Toni AI auttaa jäsentämään tehtävänannon ja tekee kanssasi suunnitelman?",
      action: "Tee suunnitelma",
      confidence
    };
  }
}
