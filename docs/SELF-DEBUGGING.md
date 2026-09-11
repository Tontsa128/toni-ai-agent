# Self-debugging

The self-debugger closes the observable error loop without turning the model into an unrestricted repair agent.

## Loop

`execute -> observe failure -> classify -> targeted check -> bounded retry -> verify -> repair plan`

Rules:

- maximum retry count is bounded;
- only observable error summaries are retained;
- hidden chain-of-thought is never stored;
- permission/access failures are not bypassed;
- timeouts and safety limits are never disabled to make a retry succeed;
- destructive or external-state repairs still pass through the normal supervisor and approval path;
- after the retry budget is exhausted, the agent produces a concise human-reviewable repair plan.
