# Toni AI Agent

Personal AI operating-system agent for coding, school assistance, research and controlled computer automation.

## Architecture

```text
User
 ↓
Orchestrator → Context Builder
 ↓
Reasoning / Planner
 ↓
Toolchain Supervisor
 ↓
Permission Engine → Human Approval
 ↓
Sandbox / Typed Tools
 ↓
Result Validation
 ↓
Self-Debugging
 ↓
Project Memory
 ↓
OpenAI Responses API / Model Provider
```

## Implemented foundation

- central orchestrator, planner and permission engine
- human approval manager
- Windows-oriented workspace/command preflight and bounded terminal executor
- typed tool registry and read-only Git adapter
- OpenAI Responses API provider boundary
- context builder that excludes secrets and records project constraints
- browser/computer/school/research adapter contracts
- multi-agent task coordinator
- project memory persistence with secret-pattern blocking
- tests for sandbox and permission behavior

## Safety model

### Green — automatic
Read, analyse, prepare drafts and safe workspace operations.

### Yellow — approval required
Browser writes, GitHub writes, Git push/commit, downloads, installs and computer interaction.

### Red — explicit approval / never automatic where configured
School submission, messages/email, production deployment, administrator operations, system changes and destructive commands.

The model never receives unrestricted operating-system authority. The supervisor and permission engine remain authoritative.

## OpenAI integration

The agent uses the OpenAI Node SDK and Responses API through `agent/providers/OpenAIProvider.ts`. Set `OPENAI_API_KEY` locally and optionally `OPENAI_MODEL`. Never commit credentials, cookies, MFA codes or other secrets.

## Development

```bash
npm install
npm run check
npm test
npm run build
npm start -- "Tarkista projektin tila"
```

## Roadmap

1. Core safety/orchestration — implemented
2. Windows execution boundary — implemented as a bounded adapter; OS-enforced sandbox still required for production isolation
3. OpenAI model provider — implemented
4. Typed tool registry and Git read layer — implemented
5. Real Playwright browser adapter — next
6. Computer automation adapter — next
7. School/Microsoft 365 adapter — next
8. Research/web source adapter — next
9. GitHub write/PR adapter — approval-gated
10. Persistent encrypted memory and audit storage
11. Full integration/CI tests and Windows installer

See `docs/FULL-ARCHITECTURE.md` and the phase documents for implementation rules.
