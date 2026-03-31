-- Sprint 5: Trends Dashboard — stores keyword trend data from Google Trends pipeline.

CREATE TABLE IF NOT EXISTS keyword_trends (
  id TEXT PRIMARY KEY,
  keyword TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'google_trends',
  volume INTEGER DEFAULT 0,
  growth_pct REAL DEFAULT 0,
  related_topics_json TEXT DEFAULT '[]',
  time_series_json TEXT DEFAULT '[]',
  snapshot_date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(keyword, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_trends_keyword ON keyword_trends(keyword);
CREATE INDEX IF NOT EXISTS idx_trends_date ON keyword_trends(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_trends_growth ON keyword_trends(growth_pct DESC);
