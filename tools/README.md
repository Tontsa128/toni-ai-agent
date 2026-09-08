# Tools

Planned tool adapters:

- `filesystem/` — workspace-scoped read/write with path validation.
- `terminal/` — command execution with allowlists and approval gates.
- `git/` — status, diff, branch, commit and push operations.
- `github/` — repository, issue and pull-request operations.
- `browser/` — authenticated browser automation with explicit approval for writes/submissions.
- `computer/` — future desktop automation.

Each adapter must return structured results and must not hide failures.
