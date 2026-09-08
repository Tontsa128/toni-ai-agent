# Agent layers 0.4

The repository now has typed boundaries for:

- tool registration
- read-only Git operations
- browser sessions
- computer control
- school workflows
- research workflows
- multi-agent task coordination
- project memory persistence

These are deliberately adapters/interfaces rather than unrestricted automation. Each real adapter must pass through the central supervisor and permission engine before performing a write, submission, message, download, or system action.

## Production rule

A capability is not considered implemented merely because a TypeScript interface exists. A production adapter must have integration tests, explicit permission mapping, audit events, failure handling, and an approval path where required.
