-- AI Actions cache table (Sprint 6, Phase 6B)
CREATE TABLE IF NOT EXISTS idea_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_actions_lookup
  ON idea_actions(idea_id, action_type, created_at);
