# Data Flow

User input enters the authenticated local HTTP boundary, receives a request/session context, and is passed to the orchestrator. Model tool calls are inspected by the supervisor before execution. Yellow-risk actions pause for approval; red-risk actions require separate policy. Approved arguments are re-hashed and consumed immediately before execution. Worker execution is isolated and bounded. Audit events contain safe summaries rather than raw prompts or secrets. OCR is transient and raw screenshots are not retained.
