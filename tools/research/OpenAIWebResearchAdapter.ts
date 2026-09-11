import OpenAI from "openai";
import type { ResearchAdapter, ResearchResult, ResearchSource } from "./ResearchTypes.js";

/**
 * Read-only research adapter backed by the OpenAI Responses API web-search tool.
 * The model is used only for source discovery/synthesis; local permissions still
 * govern every non-read action elsewhere in the agent.
 */
export class OpenAIWebResearchAdapter implements ResearchAdapter {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(model = process.env.OPENAI_MODEL ?? "gpt-5.6-luna") {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = model;
  }

  async search(query: string, options: { maxResults?: number; domains?: string[] } = {}): Promise<ResearchResult> {
    const domainHint = options.domains?.length ? ` Prefer these domains: ${options.domains.join(", ")}.` : "";
    const response = await this.client.responses.create({
      model: this.model,
      input: `Research this query using current web sources. Return a concise evidence-based synthesis and clearly identify source URLs. Query: ${query}.${domainHint}`,
      tools: [{ type: "web_search" } as never]
    });

    const sources: ResearchSource[] = [];
    for (const item of response.output) {
      const record = item as unknown as { annotations?: Array<{ type?: string; url?: string; title?: string }> };
      for (const annotation of record.annotations ?? []) {
        if (annotation.url && /^https?:$/.test(new URL(annotation.url).protocol)) {
          if (!sources.some((source) => source.url === annotation.url)) {
            sources.push({
              title: annotation.title ?? new URL(annotation.url).hostname,
              url: annotation.url,
              retrievedAt: new Date().toISOString()
            });
          }
        }
      }
    }

    return {
      query,
      answer: response.output_text,
      sources: sources.slice(0, options.maxResults ?? 10),
      provider: "openai-web-search"
    };
  }

  async fetch(url: string): Promise<ResearchSource & { text: string }> {
    const { HttpResearchAdapter } = await import("./HttpResearchAdapter.js");
    return new HttpResearchAdapter().fetch(url);
  }
}
