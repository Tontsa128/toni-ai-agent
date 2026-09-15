import type { ScreenObservation } from "./ScreenObservation.js";

export type ScreenContextKind = "school" | "business" | "coding" | "general";

export interface ScreenSuggestion {
  kind: ScreenContextKind;
  title: string;
  message: string;
  action: string;
  confidence: number;
}

const signals: Record<Exclude<ScreenContextKind, "general">, string[]> = {
  school: [
    "tehtävä", "tehtävänanto", "oppimistehtävä", "liiketoimintasuunnitelma",
    "business plan", "kurssi", "oppitunti", "raportti", "essee", "osaamistavoite"
  ],
  business: [
    "liiketoiminta", "liiketoimintasuunnitelma", "budjetti", "myynti", "asiakas",
    "markkinointi", "kannattavuus", "tarjous", "invoice", "business plan"
  ],
  coding: [
    "typescript", "javascript", "python", "stack trace", "error", "exception",
    "build failed", "npm", "git", "github", "pull request", "compile", "syntax error"
  ]
};

function normalize(value: string): string {
  return value.toLocaleLowerCase("fi-FI");
}

/**
 * Produces short, non-intrusive suggestions from already-authorized screen
 * observations. It never performs the suggested action itself.
 */
export class ScreenContextAssistant {
  analyse(observation: ScreenObservation): ScreenSuggestion | undefined {
    const text = normalize([
      observation.activeWindowTitle ?? "",
      observation.activeApplication ?? "",
      observation.visibleText ?? ""
    ].join(" "));

    const ranked = (Object.entries(signals) as Array<[Exclude<ScreenContextKind, "general">, string[]]>)
      .map(([kind, terms]) => ({ kind, matches: terms.filter((signal) => text.includes(signal)).length }))
      .filter((item) => item.matches > 0)
      .sort((a, b) => b.matches - a.matches);

    const best = ranked[0];
    if (!best) return undefined;

    const confidence = Math.min(0.99, 0.55 + best.matches * 0.08);
    if (best.kind === "school") {
      return {
        kind: "school",
        title: "Näyttää siltä, että olet koulutehtävässä",
        message: "Haluatko, että Toni AI auttaa jäsentämään tehtävänannon ja tekee kanssasi suunnitelman?",
        action: "Tee suunnitelma",
        confidence
      };
    }

    if (best.kind === "coding") {
      return {
        kind: "coding",
        title: "Näyttää siltä, että koodissa on työ kesken",
        message: "Haluatko, että Toni AI auttaa tutkimaan virheen ja tekemään korjaussuunnitelman?",
        action: "Tutki virhe",
        confidence
      };
    }

    return {
      kind: "business",
      title: "Näyttää siltä, että työskentelet liiketoiminta-asian parissa",
      message: "Haluatko, että Toni AI auttaa jäsentämään asian ja tekemään seuraavat vaiheet?",
      action: "Tee suunnitelma",
      confidence
    };
  }
}
