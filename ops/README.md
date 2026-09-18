# Operations

Production data lives under `TONI_DATA_ROOT`, outside the source tree. Stop the service before restore. Backups contain SQLite, audit/log directories and non-secret recovery metadata; never back up `.env` or API keys. After restore, startup runs migrations, SQLite integrity verification and audit-chain verification before readiness.
