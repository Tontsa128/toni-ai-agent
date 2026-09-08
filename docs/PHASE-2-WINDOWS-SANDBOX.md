# Phase 2 — Windows execution boundary

The agent now has a preflight boundary and a local terminal adapter designed for Windows development work.

## Rules

1. The working directory must remain under the configured workspace root.
2. Commands matching deny patterns are blocked before execution.
3. An executable allowlist can restrict commands further.
4. Output and execution time are bounded.
5. The adapter does **not** claim to be a kernel-level sandbox. Production isolation should use Windows Sandbox, a restricted container, or another OS-enforced boundary.
6. The model cannot directly execute a command: the orchestrator/supervisor/permission layer must authorize the tool invocation first.

## Next implementation order

1. OpenAI Responses API tool-calling adapter
2. Tool registry with typed schemas
3. Git/GitHub read/write adapters
4. Browser automation with isolated profiles
5. Computer automation with explicit approval gates
6. School/research agents
7. Persistent encrypted memory
8. CI, integration tests and installer
