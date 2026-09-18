# Incident Response

## Suspected secret leak
1. Stop the agent and revoke the affected credential.
2. Preserve relevant audit records.
3. Inspect recent tool calls, worker logs and external API activity.
4. Rotate credentials and restore from a known-good backup if necessary.
5. Record root cause and corrective action.

## Unauthorized computer activity
1. Trigger emergency stop.
2. Stop worker processes.
3. Preserve audit evidence.
4. Revoke active sessions.
5. Do not restart until the cause is understood.

## Database corruption
1. Stop all instances.
2. Preserve the damaged copy.
3. Verify a backup in a separate location.
4. Restore and run integrity/audit checks.
5. Start only after readiness succeeds.
