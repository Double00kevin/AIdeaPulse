CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  skills_json TEXT NOT NULL DEFAULT '[]',
  budget_range TEXT NOT NULL DEFAULT 'low'
    CHECK(budget_range IN ('bootstrapped', 'low', 'medium', 'high')),
  niches_json TEXT NOT NULL DEFAULT '[]',
  experience_level TEXT NOT NULL DEFAULT 'beginner'
    CHECK(experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  updated_at TEXT DEFAULT (datetime('now'))
);
