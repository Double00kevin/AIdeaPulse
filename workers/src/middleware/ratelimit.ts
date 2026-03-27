/**
 * Simple rate limiting using D1.
 * Tracks requests per user per day. Free tier: 50 req/day, Pro: 1000 req/day.
 */

import type { Context, Next } from "hono";
import type { Env } from "../index";

const FREE_LIMIT = 50;
const PRO_LIMIT = 1000;

interface RateLimitRow {
  request_count: number;
}

/**
 * Rate limit middleware for authenticated API routes.
 * Requires userId to be set (use after requireAuth).
 */
export function rateLimit() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Authentication required for rate limiting" }, 401);
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `${userId}:${today}`;

    // Check current count
    const row = await c.env.DB.prepare(
      "SELECT request_count FROM rate_limits WHERE key = ?",
    )
      .bind(key)
      .first<RateLimitRow>();

    const currentCount = row?.request_count ?? 0;

    // Check if user is Pro (has active subscription)
    const sub = await c.env.DB.prepare(
      "SELECT plan FROM subscriptions WHERE user_id = ? AND status = 'active'",
    )
      .bind(userId)
      .first<{ plan: string }>();

    const limit = sub?.plan === "pro" ? PRO_LIMIT : FREE_LIMIT;

    if (currentCount >= limit) {
      c.header("X-RateLimit-Limit", String(limit));
      c.header("X-RateLimit-Remaining", "0");
      return c.json(
        { error: "Rate limit exceeded", limit, reset: "midnight UTC" },
        429,
      );
    }

    // Increment counter
    await c.env.DB.prepare(
      `INSERT INTO rate_limits (key, request_count)
       VALUES (?, 1)
       ON CONFLICT(key) DO UPDATE SET request_count = request_count + 1`,
    )
      .bind(key)
      .run();

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(limit - currentCount - 1));
    await next();
  };
}
