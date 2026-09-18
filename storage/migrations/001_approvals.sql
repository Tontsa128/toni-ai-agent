CREATE TABLE IF NOT EXISTS approvals (
  approval_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  argument_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_approvals_active ON approvals (approval_id, expires_at, used);