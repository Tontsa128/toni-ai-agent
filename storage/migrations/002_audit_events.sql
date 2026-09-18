CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  user_id TEXT,
  session_id TEXT,
  action_id TEXT,
  tool_name TEXT,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  previous_hash TEXT,
  hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_session ON audit_events (session_id);