import { validateResearchUrl, type ResearchAdapter, type ResearchResult, type ResearchSource } from "./ResearchTypes.js";

export interface HttpResearchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  userAgent?: string;
}

/**
 * Safe, read-only source retrieval. It does not execute page scripts and never submits forms.
 * Search is intentionally not guessed here; a search provider must implement that contract.
 */
export class HttpResearchAdapter implements ResearchAdapter {
  private readonly maxBytes: number;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(options: HttpResearchOptions = {}) {
    this.maxBytes = options.maxBytes ?? 1_000_000;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.userAgent = options.userAgent ?? "toni-ai-agent-research/1.0";
  }

  async search(_query: string): Promise<ResearchResult> {
    throw new Error("No search provider configured. Use an approved search provider or the browser research adapter.");
  }

  async fetch(url: string): Promise<ResearchSource & { text: string }> {
    const parsed = validateResearchUrl(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(parsed, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": this.userAgent, Accept: "text/html,text/plain,application/xhtml+xml" }
      });
      if (!response.ok) throw new Error(`Research fetch failed: HTTP ${response.status}`);

      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > this.maxBytes) throw new Error("Research response exceeds size limit");

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > this.maxBytes) throw new Error("Research response exceeds size limit");

      const text = buffer.toString("utf8");
      return {
        title: parsed.hostname,
        url: response.url,
        retrievedAt: new Date().toISOString(),
        text
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
