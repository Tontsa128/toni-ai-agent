# Production Hardening Work Plan

This document is the execution checklist for the final hardening pass before local Windows use and cloud deployment.

## Phase A — security boundaries

- [x] Establish a dedicated hardening branch.
- [x] Add a process-wide computer emergency-stop latch and wire it into desktop tool execution.
- [x] Add an authenticated HTTP emergency-stop endpoint in production mode.
- [x] Make screen monitoring explicitly opt-in; OCR is not enabled unless screen monitoring is enabled and OCR is explicitly enabled.
- [x] Add regression tests for the emergency stop and screen monitor default-off behavior.
- [x] Add untrusted-content / prompt-injection boundary and tests.
- [x] Add HTTP/API rate limiting and abuse controls.
- [x] Complete upload content validation and hostile-file tests.
- [x] Verify every browser/computer execution path is supervisor-gated.
- [ ] Verify user/session/approval isolation for cloud operation.

## Phase B — persistence and recovery

- [x] Make migration discovery independent of the process working directory.
- [x] Verify SQLite WAL, busy timeout, foreign keys and transaction semantics.
- [x] Verify audit hash-chain concurrency and restart integrity.
- [x] Design retention so audit-chain integrity is preserved.
- [x] Make restore require the application process lock and perform atomic replacement (POSIX atomic rename; Windows rollback-safe replacement).
- [x] Add post-restore database + audit verification.
- [x] Recovery/retention tests use disposable in-memory test data.

## Phase C — runtime and operations

- [ ] Verify shutdown releases process lock and closes all resources.
- [ ] Verify readiness cannot become healthy before all required startup checks pass.
- [ ] Add production-like local smoke test.
- [ ] Verify OpenAI timeout/cancellation and provider budget behavior end-to-end.
- [ ] Verify cost accounting fails closed for unknown model pricing.
- [ ] Verify logs/metrics never expose prompts, secrets or credentials.

## Phase D — Windows local acceptance

- [ ] Clean install from committed lockfile.
- [ ] Configure real OpenAI credentials locally without committing secrets.
- [ ] Test chat, safe tools, approval tools and rejected tools.
- [ ] Test worker timeout/cancellation/memory/process limits.
- [ ] Test browser and computer controls with emergency stop.
- [ ] Test backup, restart and restore.

## Phase E — cloud readiness

- [ ] Replace single-user local session architecture with real per-user sessions.
- [ ] Add production authentication/session management and role separation.
- [ ] Add HTTPS and secret management.
- [ ] Add persistent storage and automated backups.
- [ ] Add deployment health checks, restart policy and monitoring.
- [ ] Perform multi-user isolation, abuse and recovery tests.

## Release rule

No production-cloud release is considered complete until every applicable unchecked item above has been implemented, tested, and evidenced. CI success alone is not treated as proof of real-environment readiness.
