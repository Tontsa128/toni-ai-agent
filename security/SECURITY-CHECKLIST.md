# Security Checklist

- [ ] Every tool execution enters the supervisor.
- [ ] No direct child-process execution bypasses the worker boundary.
- [ ] Approval is bound to authenticated user/session/action/argument hash.
- [ ] Red-risk actions are not normal yellow approvals.
- [ ] Workspace and symlink boundaries are enforced.
- [ ] Request authentication is enabled in production.
- [ ] Secrets are absent from logs and source control.
- [ ] Raw screenshots are disabled.
- [ ] Session/provider/cost budgets are enforced.
- [ ] SQLite integrity and audit-chain checks run at readiness.
- [ ] Backup and restore are tested.
- [ ] Windows Job Object is tested on Windows.
- [ ] Service account uses least privilege.
