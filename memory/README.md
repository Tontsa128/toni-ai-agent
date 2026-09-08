# Memory

Memory is separated by scope:

- `project/` — repository-specific state, decisions, architecture and known issues.
- `user/` — durable non-sensitive preferences explicitly useful to the assistant.
- `sessions/` — short-lived task context and tool results.

Never store passwords, API keys, MFA codes, session cookies or other secrets.
