-- Sprint 5: Add narrative writeups, multi-dimensional scores, community signals,
-- and framework analysis columns. Also expand source_type CHECK for all 12 sources.
-- Uses table recreation pattern (D1/SQLite has no ALTER COLUMN).

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
    'hackernews', 'github_trending', 'devto', 'lobsters', 'newsapi',
    'stackexchange', 'github_issues', 'discourse', 'package_trends'
  )),
  created_at TEXT DEFAULT (datetime('now')),
  -- Sprint 5: Rich narrative writeups
  narrative_writeup TEXT DEFAULT '',
  product_name TEXT DEFAULT '',
  validation_playbook TEXT DEFAULT '',
  gtm_strategy TEXT DEFAULT '',
  -- Sprint 5: Multi-dimensional scores (JSON: {opportunity, pain_level, builder_confidence, timing})
  scores_json TEXT DEFAULT '{}',
  -- Sprint 5: Community signals (JSON array of signal dicts)
  community_signals_json TEXT DEFAULT '[]',
  -- Sprint 5/6: Framework analysis (JSON: {value_equation, acp, value_matrix, value_ladder})
  frameworks_json TEXT DEFAULT '{}',
  UNIQUE(title_normalized)
);

INSERT INTO ideas_new (
  id, title, title_normalized, one_liner, problem_statement,
  target_audience, market_size_json, competitors_json, competitor_count,
  build_complexity, build_timeline, monetization_angle,
  confidence_score, source_links_json, source_type, created_at,
  narrative_writeup, product_name, validation_playbook, gtm_strategy,
  scores_json, community_signals_json, frameworks_json
)
SELECT
  id, title, title_normalized, one_liner, problem_statement,
  target_audience, market_size_json, competitors_json, competitor_count,
  build_complexity, build_timeline, monetization_angle,
  confidence_score, source_links_json, source_type, created_at,
  '', '', '', '',
  '{}', '[]', '{}'
FROM ideas;

DROP TABLE ideas;
ALTER TABLE ideas_new RENAME TO ideas;

CREATE INDEX IF NOT EXISTS idx_ideas_confidence ON ideas(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_complexity ON ideas(build_complexity);
CREATE INDEX IF NOT EXISTS idx_ideas_source ON ideas(source_type);
