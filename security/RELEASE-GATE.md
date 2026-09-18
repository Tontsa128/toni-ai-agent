# Production Release Gate

A release is production-ready only when every required gate is green.

## Build and dependency integrity
- [ ] npm install completes without errors.
- [ ] npm run check passes.
- [ ] npm run build passes.
- [ ] npm test passes.
- [ ] Dependency audit has no high/critical findings requiring an accepted exception.
- [ ] A committed package-lock.json is present before production release; CI must use npm ci.

## Runtime safety
- [ ] Production requires OPENAI_API_KEY, OPENAI_MODEL, TONI_AUTH_TOKEN and TONI_DATA_ROOT.
- [ ] Workspace exists and is readable.
- [ ] SQLite integrity and foreign-key checks pass.
- [ ] Audit hash chain verifies before readiness.
- [ ] Only one runtime process can hold the application lock.
- [ ] /health stays available while /ready is false until startup completes.

## Execution security
- [ ] All process execution goes through the worker/supervisor boundary.
- [ ] Red-risk actions remain blocked by policy.
- [ ] Yellow-risk actions require approval bound to user/session/action/tool/input hash.
- [ ] Approval consumption is atomic immediately before execution.
- [ ] Worker timeout, cancellation and output limits are tested.
- [ ] Windows Job Object helper is built and exercised on Windows CI.
- [ ] Browser/computer actions remain behind the same supervisor.

## Privacy and cost
- [ ] Session token/USD budgets are enforced per session.
- [ ] Provider request budget is enforced per session.
- [ ] Sensitive-content filtering is applied to every text input path.
- [ ] Raw screenshots remain disabled.
- [ ] Logs/audit output are redacted and do not contain API keys or bearer tokens.
- [ ] Retention/deletion procedures are documented and tested.

## Recovery
- [ ] SQLite backup uses the live database backup API.
- [ ] Restore validates integrity and audit chain before replacing the live database.
- [ ] Backup/restore procedure has been exercised on a disposable copy.
- [ ] Application shutdown releases the process lock.

## Security review
- [ ] Threat model, data flow, security checklist and incident response documents are current.
- [ ] Security boundary scan passes.
- [ ] Secret scanning is configured before production release.
- [ ] Any remaining exceptions are documented, owned and explicitly accepted.

This document is a gate, not evidence that every checkbox has passed. Do not label the repository production-ready until unchecked items have actual test or CI evidence.
