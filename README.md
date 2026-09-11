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
OpenAI Tool Loop
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
Encrypted Project Memory + Audit
```

## Implemented foundation

- central orchestrator, planner and permission engine
- human approval manager
- Windows-oriented workspace/command preflight and bounded terminal executor
- typed tool registry and read-only Git layer
- OpenAI Responses API provider boundary
- bounded OpenAI function/tool execution loop
- supervisor bridge that blocks yellow/red tool calls until approval
- deterministic bounded self-debugging policy
- AES-256-GCM encrypted project memory option
- hash-chained audit logger with secret-pattern redaction
- context builder that excludes secrets and records project constraints
- Playwright browser adapter
- Windows computer-control adapter with blocked credential/system-level input
- read-focused Microsoft Graph school adapter
- research source contracts, bounded HTTP retrieval and OpenAI web-search adapter
- multi-agent task coordinator

## Safety model

### Green — automatic
Read, analyse, prepare drafts and safe workspace operations.

### Yellow — approval required
Browser writes, GitHub writes, Git push/commit, downloads, installs and computer interaction.

### Red — explicit approval / never automatic where configured
School submission, messages/email, production deployment, administrator operations, system changes and destructive commands.

The model never receives unrestricted operating-system authority. The supervisor and permission engine remain authoritative.

## Research safety

Research adapters are read-only. HTTP retrieval is size- and timeout-bounded, accepts only HTTP(S), and does not execute page scripts. The OpenAI web-search adapter is used for source discovery/synthesis; source URLs and retrieval times are retained when available. Research never receives passwords, API keys, cookies or MFA codes.

## Self-debugging

The self-debugger classifies observable failures, recommends targeted checks, bounds retries and stops when permission/access controls are involved. It stores concise failure summaries rather than hidden chain-of-thought and never grants itself permission to repair external state.

## Memory and audit

Production memory can use `EncryptedProjectMemory` with a 32-byte `TONI_MEMORY_KEY` supplied only by the host environment. `AuditLogger` writes an append-only hash-chained audit stream and redacts common secret-like key/value patterns before persistence. The audit layer records evidence; it does not replace permission checks.

## OpenAI integration

The agent uses the OpenAI Node SDK and Responses API through `agent/providers/OpenAIProvider.ts`. The tool loop in `agent/providers/OpenAIToolLoop.ts` can process function calls, but actual execution passes through `SupervisedToolExecutor` and therefore the local permission/approval boundary. Set `OPENAI_API_KEY` locally and optionally `OPENAI_MODEL`. Current example default: `gpt-5.6-luna`.

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
5. Real Playwright browser adapter — implemented
6. Computer automation adapter — implemented
7. School/Microsoft 365 adapter — implemented as read-focused Graph integration
8. Research/web source adapter — implemented
9. GitHub write/PR adapter — approval-gated
10. OpenAI tool-calling execution loop — implemented
11. Approval resume/stateful tool continuation — next
12. Self-debugging closed loop — implemented as bounded policy
13. Persistent encrypted memory and audit storage — implemented
14. Full integration/CI tests and Windows installer

See the phase documents in `docs/` for implementation rules.
