# Toni AI Agent – Threat Model

## Assets
- OpenAI API key
- External API tokens and credentials
- User/session/approval data
- Screen contents and OCR
- Workspace source files
- Audit records

## Trust boundaries
1. UI → local HTTP server
2. Model → tool supervisor
3. Main process → worker
4. Worker → operating system
5. Agent → external APIs
6. Workspace → filesystem outside workspace

## Threats and controls
- Prompt injection: untrusted content must never become policy.
- Approval replay/substitution: bind approval to user, session, action and argument hash and consume atomically.
- Path/symlink escape: enforce canonical workspace boundaries.
- Secret leakage: redact logs and reject detected secrets before model processing where possible.
- Process escape: worker isolation, timeouts, bounded output and Windows Job Object in production.
- Cost exhaustion: session token/USD and provider-request budgets.
- DoS: bounded turns, tool calls, output, timeouts and cancellation.
- Privacy leakage: transient OCR and disabled raw screenshot retention.
