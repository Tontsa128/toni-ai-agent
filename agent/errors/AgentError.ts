export type AgentErrorCode = "TOOL_FAILED" | "TOOL_INPUT_INVALID" | "CANCELLED" | "BUDGET_EXCEEDED";

export class AgentError extends Error {
  constructor(
    public readonly code: AgentErrorCode,
    message: string,
    public readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AgentError";
  }
}
