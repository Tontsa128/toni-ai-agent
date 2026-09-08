export interface ResearchSource { title: string; url: string; publishedAt?: string; sourceType: "official" | "academic" | "news" | "community" | "other"; }
export interface ResearchResult { question: string; sources: ResearchSource[]; findings: string[]; uncertainties: string[]; }

export interface ResearchAgent { search(question: string): Promise<ResearchSource[]>; synthesize(question: string, sources: ResearchSource[]): Promise<ResearchResult>; }

/** Research outputs must preserve source URLs and uncertainty instead of presenting guesses as facts. */
