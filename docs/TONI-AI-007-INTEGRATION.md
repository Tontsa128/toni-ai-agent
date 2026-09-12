# Toni AI 007 → Toni AI Agent integration

This document records the useful parts of the uploaded `toni-ai-007` prototype and how they are incorporated into the production-oriented TypeScript agent.

## What the 007 prototype contributes

The prototype was reviewed as a reference implementation for:

- an interactive Windows-friendly CLI (`main.py`)
- environment-driven runtime configuration (`agent/config.py`)
- multi-provider model selection through LiteLLM
- a simple persistent facts + session-summary memory model (`agent/memory.py`)
- practical tool contracts for files, directories, Python, shell and web retrieval
- Finnish-first system instructions and coding-mode guidance
- installation/startup documentation and example requests
- a compact test suite covering configuration, memory and basic tool behavior

## What is adopted

### 1. Finnish-first operator experience

The 007 prompt and CLI conventions confirm that Toni should be usable in Finnish by default, with concise commands such as `/help`, `/reset` and `/model` where the interactive shell supports them.

### 2. Runtime configuration concepts

The useful configuration fields are retained conceptually:

- model
- maximum agent/tool-loop turns
- workspace
- memory enablement/path
- provider credentials supplied only through the host environment

The production agent does **not** copy the prototype's practice of passing provider secrets through ordinary agent state.

### 3. Tool coverage

The prototype's practical baseline is useful for the production tool roadmap:

- read/list workspace files
- write/edit workspace files
- execute bounded development commands
- execute bounded Python jobs
- retrieve web pages

These capabilities are implemented or mapped to typed tools in the TypeScript architecture. Execution must continue to pass through `ToolchainSupervisor`, `PermissionEngine` and the approval boundary.

### 4. Memory model

The prototype's distinction between durable facts and session summaries is useful product behavior. The production implementation uses the stronger encrypted project-memory layer instead of copying the plaintext JSON/Markdown persistence from 007.

### 5. Documentation and examples

The 007 installation guide and example requests are retained as product requirements: the eventual Windows installer/bootstrap must be understandable to a non-developer, and the agent should ship with practical examples for coding, school work, research and project maintenance.

## What is deliberately NOT copied

The 007 prototype directly executes tools selected by the LLM. That is not acceptable as the security boundary for Toni AI Agent.

In particular, the production architecture does not copy unrestricted:

- shell execution
- Python execution
- browser writes/submissions
- filesystem writes/deletes
- computer input

Instead, the model proposes a typed operation and the local supervisor/permission engine remains authoritative. Yellow/red actions pause for approval and approved continuations resume the exact pending operation.

The prototype's heuristic shell blocking is also not treated as a security boundary. A deny-list can be useful as an additional signal, but it cannot replace policy enforcement and OS-level isolation.

## Provider strategy

The 007 prototype's multi-provider LiteLLM design is useful for future provider abstraction, but the current production path intentionally keeps the provider boundary explicit through `ModelProvider` and the OpenAI Responses API implementation.

Future providers should implement the same provider boundary rather than reintroducing provider-specific execution logic into the orchestrator.

## Integration priorities from this review

1. Finish end-to-end supervised tool execution and approval continuation.
2. Add an interactive operator CLI on top of the existing orchestrator/tool-loop architecture.
3. Add provider adapters behind `ModelProvider` rather than coupling the core to LiteLLM.
4. Add a compatibility import path for legacy 007 facts/summaries only if users need migration from an existing installation.
5. Expand tests around the 007 baseline: file operations, workspace traversal, bounded command execution, memory behavior and Finnish operator commands.
6. Keep production memory encrypted and audit events redacted/hash-chained.

## Source reviewed

Uploaded reference archive: `toni-ai-007-pro.zip` (`toni-ai-007/`).

The archive is treated as a reference/prototype, not as the production security model. The goal is to preserve its useful user experience while moving execution into the stricter TypeScript architecture already present in `Tontsa128/toni-ai-agent`.
