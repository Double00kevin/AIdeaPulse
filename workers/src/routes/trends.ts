import { Hono } from "hono";
import type { Env } from "../index";
import { optionalAuth } from "../middleware/auth";
import { getUserTier } from "./ideas";

const trendsHandler = new Hono<{ Bindings: Env }>();

interface TrendPayload {
  keyword: string;
  source: string;
  value: number;
  related_topics: string[];
  interest_over_time?: Array<{ date: string; value: number }>;
}

interface TrendRow {
  id: string;
  keyword: string;
  source: string;
  volume: number;
  growth_pct: number;
  related_topics_json: string;
  time_series_json: string;
  snapshot_date: string;
  created_at: string;
}

// ── POST /api/ingest/trends — HMAC-authenticated pipeline push ──

trendsHandler.post("/ingest/trends", async (c) => {
  const signature = c.req.header("X-Webhook-Signature");
  const timestamp = c.req.header("X-Webhook-Timestamp");

  if (!signature || !timestamp) {
    return c.json({ error: "Missing auth headers" }, 401);
  }

  // Reuse same HMAC verification as ideas ingest
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    return c.json({ error: "Stale or invalid timestamp" }, 401);
  }

  const bodyBuffer = await c.req.arrayBuffer();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(c.env.INGEST_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expectedSig = await crypto.subtle.sign("HMAC", key, bodyBuffer);
  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (signature.length !== expectedHex.length) {
    return c.json({ error: "Invalid signature" }, 401);
  }
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  if (mismatch !== 0) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  let payload: { trends: TrendPayload[]; timestamp: number };
  try {
    payload = JSON.parse(new TextDecoder().decode(bodyBuffer));
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (!Array.isArray(payload.trends)) {
    return c.json({ error: "Missing trends array" }, 400);
  }

  const snapshotDate = new Date().toISOString().slice(0, 10);
  let inserted = 0;
  let skipped = 0;

  for (const trend of payload.trends) {
    if (!trend.keyword) {
      skipped++;
      continue;
    }

    const id = crypto.randomUUID();

    try {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO keyword_trends
         (id, keyword, source, volume, growth_pct, related_topics_json,
          time_series_json, snapshot_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          trend.keyword,
          trend.source ?? "google_trends",
          trend.value ?? 0,
          trend.value ?? 0,
          JSON.stringify(trend.related_topics ?? []),
          JSON.stringify(trend.interest_over_time ?? []),
          snapshotDate,
        )
        .run();
      inserted++;
    } catch {
      skipped++;
    }
  }

  return c.json({ inserted, skipped, total: payload.trends.length });
});

// ── GET /api/trends — List trending keywords ──

trendsHandler.get("/", async (c) => {
  const days = Math.min(90, Math.max(1, parseInt(c.req.query("days") ?? "30", 10) || 30));
  const keyword = c.req.query("keyword");
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") ?? "50", 10) || 50));

  let query = `
    SELECT * FROM keyword_trends
    WHERE snapshot_date >= date('now', '-${days} days')
  `;
  const params: string[] = [];

  if (keyword) {
    query += ` AND keyword LIKE ?`;
    params.push(`%${keyword}%`);
  }

  query += ` ORDER BY growth_pct DESC LIMIT ?`;
  params.push(String(limit));

  const rows = await c.env.DB.prepare(query)
    .bind(...params)
    .all<TrendRow>();

  const trends = (rows.results ?? []).map((row) => ({
    keyword: row.keyword,
    source: row.source,
    volume: row.volume,
    growth_pct: row.growth_pct,
    related_topics: JSON.parse(row.related_topics_json || "[]"),
    snapshot_date: row.snapshot_date,
  }));

  return c.json({ trends, count: trends.length });
});

// ── GET /api/trends/:keyword — Detailed time-series for a keyword ──

trendsHandler.get("/:keyword", async (c) => {
  const keyword = decodeURIComponent(c.req.param("keyword"));

  // Get auth status for gating
  const authHeader = c.req.header("Authorization");
  let userId: string | undefined;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { verifyClerkToken } = await import("../middleware/auth");
      userId = await verifyClerkToken(authHeader.slice(7));
    } catch {
      // optional auth, continue as anon
    }
  }

  const tier = await getUserTier(userId, c.env.DB);

  // Get latest snapshot for this keyword
  const latest = await c.env.DB.prepare(
    `SELECT * FROM keyword_trends
     WHERE keyword = ?
     ORDER BY snapshot_date DESC
     LIMIT 1`,
  )
    .bind(keyword)
    .first<TrendRow>();

  if (!latest) {
    return c.json({ error: "Keyword not found" }, 404);
  }

  const result: Record<string, unknown> = {
    keyword: latest.keyword,
    source: latest.source,
    volume: latest.volume,
    growth_pct: latest.growth_pct,
    related_topics: JSON.parse(latest.related_topics_json || "[]"),
    snapshot_date: latest.snapshot_date,
  };

  // Time-series data is Pro-only
  if (tier === "pro") {
    result.time_series = JSON.parse(latest.time_series_json || "[]");

    // Get historical snapshots
    const history = await c.env.DB.prepare(
      `SELECT snapshot_date, volume, growth_pct FROM keyword_trends
       WHERE keyword = ?
       ORDER BY snapshot_date DESC
       LIMIT 90`,
    )
      .bind(keyword)
      .all<{ snapshot_date: string; volume: number; growth_pct: number }>();

    result.history = history.results ?? [];
  } else {
    result.time_series_gated = true;
  }

  return c.json(result);
});

export { trendsHandler };
