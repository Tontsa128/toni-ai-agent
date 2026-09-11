# Memory and audit storage

## Encrypted project memory

`EncryptedProjectMemory` stores each record using AES-256-GCM. The 32-byte key is supplied by `TONI_MEMORY_KEY` and is never written by the class. Generate and protect that key locally; do not put it in Git, prompts, memory records or audit metadata.

The existing plain `FileProjectMemory` remains useful for development fixtures. Production deployments should use the encrypted implementation.

## Audit log

`AuditLogger` writes an append-only JSONL log with SHA-256 hash chaining. Each event records a timestamp, outcome/risk metadata and the previous event hash. Known secret-like key/value patterns are redacted before persistence.

Audit logging is evidence of what the agent attempted/executed; it is not a permission system. The supervisor remains authoritative.
