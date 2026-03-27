-- Expand source_type to support new scrapers.
-- D1/SQLite doesn't support ALTER COLUMN, so we drop and recreate the CHECK constraint
-- by recreating the table. Existing data is preserved.

CREATE TABLE ideas_new (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_normalized TEXT NOT NULL,
  one_liner TEXT NOT NULL,
  problem_statement TEXT,
  target_audience TEXT,
  market_size_json TEXT,
  competitors_json TEXT,
  competitor_count INTEGER DEFAULT 0,
  build_complexity TEXT CHECK(build_complexity IN ('low', 'medium', 'high')),
  build_timeline TEXT,
  monetization_angle TEXT,
  confidence_score INTEGER CHECK(confidence_score BETWEEN 0 AND 100),
  source_links_json TEXT,
  source_type TEXT CHECK(source_type IN (
    'reddit', 'google_trends', 'producthunt',
    'hackernews', 'github_trending', 'devto', 'lobsters', 'newsapi'
  )),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(title_normalized)
);

INSERT INTO ideas_new SELECT * FROM ideas;
DROP TABLE ideas;
ALTER TABLE ideas_new RENAME TO ideas;

CREATE INDEX IF NOT EXISTS idx_ideas_confidence ON ideas(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_complexity ON ideas(build_complexity);
CREATE INDEX IF NOT EXISTS idx_ideas_source ON ideas(source_type);
