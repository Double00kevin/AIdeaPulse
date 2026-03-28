import { env } from "cloudflare:test";

// Apply the final schema (equivalent to all migrations applied in order)
// to the miniflare D1 test database before tests run.

const statements = [
  `CREATE TABLE IF NOT EXISTS ideas (
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ideas_confidence ON ideas(confidence_score DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_ideas_complexity ON ideas(build_complexity)`,
  `CREATE INDEX IF NOT EXISTS idx_ideas_source ON ideas(source_type)`,
  `CREATE TABLE IF NOT EXISTS saved_ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    idea_id TEXT NOT NULL REFERENCES ideas(id),
    rating INTEGER CHECK(rating BETWEEN 1 AND 5),
    saved_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, idea_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_ideas(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_saved_idea ON saved_ideas(idea_id)`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    user_id TEXT PRIMARY KEY,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free', 'pro')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'canceled')),
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    request_count INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    skills_json TEXT NOT NULL DEFAULT '[]',
    budget_range TEXT NOT NULL DEFAULT 'low'
      CHECK(budget_range IN ('bootstrapped', 'low', 'medium', 'high')),
    niches_json TEXT NOT NULL DEFAULT '[]',
    experience_level TEXT NOT NULL DEFAULT 'beginner'
      CHECK(experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS daily_free_claims (
    user_id TEXT NOT NULL,
    idea_id TEXT NOT NULL,
    claimed_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, claimed_date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_daily_free_claims_user ON daily_free_claims(user_id, claimed_date)`,
];

await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
