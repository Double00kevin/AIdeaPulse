-- Generated ideas table (Sprint 6, Phase 6B)
CREATE TABLE IF NOT EXISTS generated_ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  ideas_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_generated_user
  ON generated_ideas(user_id, created_at);
