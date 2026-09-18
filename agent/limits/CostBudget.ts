export interface UsageCost { inputTokens: number; outputTokens: number; estimatedUsd: number; }
export class CostBudget {
  private inputTokens = 0; private outputTokens = 0; private estimatedUsd = 0;
  constructor(private readonly maxInputTokens: number, private readonly maxOutputTokens: number, private readonly maxUsd: number) {
    if (maxInputTokens < 1 || maxOutputTokens < 1 || maxUsd <= 0) throw new Error("Invalid cost budget.");
  }
  consume(usage: UsageCost): void {
    if (![usage.inputTokens, usage.outputTokens, usage.estimatedUsd].every(Number.isFinite) || usage.inputTokens < 0 || usage.outputTokens < 0 || usage.estimatedUsd < 0) throw new Error("Invalid usage.");
    const nextInput = this.inputTokens + usage.inputTokens, nextOutput = this.outputTokens + usage.outputTokens, nextUsd = this.estimatedUsd + usage.estimatedUsd;
    if (nextInput > this.maxInputTokens || nextOutput > this.maxOutputTokens || nextUsd > this.maxUsd) throw new Error("Session cost budget exceeded.");
    this.inputTokens = nextInput; this.outputTokens = nextOutput; this.estimatedUsd = nextUsd;
  }
  snapshot(): UsageCost { return { inputTokens: this.inputTokens, outputTokens: this.outputTokens, estimatedUsd: this.estimatedUsd }; }
}
