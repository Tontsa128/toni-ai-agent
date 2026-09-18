export class SessionBudget {
  private toolCalls = 0;
  constructor(private readonly maxToolCalls: number) {
    if (!Number.isInteger(maxToolCalls) || maxToolCalls < 1) throw new Error("Session tool-call budget must be a positive integer.");
  }
  consumeToolCall(): void {
    if (this.toolCalls >= this.maxToolCalls) throw new Error(`Session tool-call budget exceeded (${this.maxToolCalls}).`);
    this.toolCalls += 1;
  }
  getToolCalls(): number { return this.toolCalls; }
  getRemaining(): number { return this.maxToolCalls - this.toolCalls; }
  getRemainingToolCalls(): number { return this.getRemaining(); }
}
