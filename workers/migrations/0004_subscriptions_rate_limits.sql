-- Stripe subscriptions table.
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free', 'pro')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'canceled')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Rate limiting table (key = "userId:YYYY-MM-DD").
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0
);
