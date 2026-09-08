# Toni AI Agent

Personal AI operating-system agent for coding, school assistance, research and controlled computer automation.

## Architecture

```text
User
 ↓
Orchestrator
 ↓
Reasoning Layer → Plan Validator
 ↓
Toolchain Supervisor
 ↓
Permission Engine → Human Approval
 ↓
Sandbox / Tools
 ↓
Result Validation
 ↓
Self-Debugging Engine
 ↓
Project Memory
 ↓
Model Provider
```

## Modules

- `agent/core` — orchestration and planning
- `agent/reasoning` — structured planning and validation
- `agent/supervisor` — central tool security gate
- `agent/sandbox` — execution boundary; production execution requires a real OS/container sandbox adapter
- `agent/approvals` and `agent/hitl` — human-in-the-loop control
- `agent/debugging` — error classification and self-debugging foundation
- `agent/memory` — project-scoped long-term memory interfaces
- `agent/telemetry` — audit events and health monitoring
- `agent/providers` — model-provider abstraction and OpenAI adapter boundary
- `agent/boot` — startup sequence
- `tools` — controlled tool adapters
- `school` — learning and school-account workflow
- `docs` — architecture and integration rules

## Safety model

### Green — automatic
Read, analyse, prepare drafts, and safe workspace operations.

### Yellow — approval required
Package installation, external uploads, browser writes, GitHub writes and potentially destructive actions.

### Red — explicit approval
School submission, messages/email, production deployment, administrator operations, system changes and destructive commands.

The model never gets unrestricted operating-system authority. Permissions and supervisor checks remain authoritative.

## Model context protocol

When asking a model for help, provide structured context: request, project state, relevant files, current error, previous attempts, constraints and acceptance criteria. Never include API keys, passwords, MFA codes or other secrets. Store concise plans and outcomes rather than hidden chain-of-thought.

## School safety

The assistant can explain, draft and review school work. It must respect the school's AI policy. It must never bypass Microsoft 365 tenant controls, MFA, CAPTCHA or access restrictions. Submission remains a human-approved action.

## Roadmap

1. Core safety and orchestration foundation — implemented
2. Real sandbox adapter — next
3. Full model tool-calling adapter
4. Git/GitHub toolchain
5. Browser automation with isolated profiles
6. Computer automation
7. School and research agents
8. Multi-agent coordinator
9. Persistent encrypted project memory
10. Full testing, packaging and local installation
