export interface ResearchSource {
  title: string;
  url: string;
  snippet?: string;
  retrievedAt: string;
}

export interface ResearchResult {
  query: string;
  answer: string;
  sources: ResearchSource[];
  provider: string;
}

export interface ResearchAdapter {
  search(query: string, options?: { maxResults?: number; domains?: string[] }): Promise<ResearchResult>;
  fetch(url: string): Promise<ResearchSource & { text: string }>;
}

export function validateResearchUrl(url: string): URL {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error("Research adapter only accepts HTTP(S) URLs");
  }
  return parsed;
}
