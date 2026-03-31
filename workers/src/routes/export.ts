import { Hono } from "hono";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { getUserTier } from "./ideas";

const exportHandler = new Hono<{ Bindings: Env }>();

exportHandler.use("/*", requireAuth);

// ── GET /api/export/ideas — Pro-only JSON export ──

exportHandler.get("/ideas", async (c) => {
  const userId = c.get("userId") as string;
  const tier = await getUserTier(userId, c.env.DB);

  if (tier !== "pro") {
    return c.json({ error: "Pro subscription required for data export" }, 403);
  }

  // Rate limit: 10 exports per day
  const today = new Date().toISOString().slice(0, 10);
  const rateKey = `export:${userId}:${today}`;
  const rateRow = await c.env.DB.prepare(
    "SELECT request_count FROM rate_limits WHERE key = ?",
  )
    .bind(rateKey)
    .first<{ request_count: number }>();

  if (rateRow && rateRow.request_count >= 10) {
    return c.json({ error: "Export limit reached (10/day)" }, 429);
  }

  // Increment rate limit
  await c.env.DB.prepare(
    `INSERT INTO rate_limits (key, request_count) VALUES (?, 1)
     ON CONFLICT(key) DO UPDATE SET request_count = request_count + 1`,
  )
    .bind(rateKey)
    .run();

  const scope = c.req.query("scope") ?? "all";

  let ideas;
  if (scope === "saved") {
    const rows = await c.env.DB.prepare(
      `SELECT i.*, s.rating, s.saved_at
       FROM saved_ideas s
       JOIN ideas i ON s.idea_id = i.id
       WHERE s.user_id = ?
       ORDER BY s.saved_at DESC`,
    )
      .bind(userId)
      .all();
    ideas = rows.results ?? [];
  } else {
    const rows = await c.env.DB.prepare(
      "SELECT * FROM ideas ORDER BY created_at DESC LIMIT 1000",
    ).all();
    ideas = rows.results ?? [];
  }

  // Format ideas for export
  const formatted = ideas.map((row: Record<string, unknown>) => ({
    id: row.id,
    title: row.title,
    product_name: row.product_name || "",
    one_liner: row.one_liner,
    problem_statement: row.problem_statement,
    target_audience: row.target_audience,
    market_size: JSON.parse((row.market_size_json as string) || "{}"),
    competitors: JSON.parse((row.competitors_json as string) || "[]"),
    competitor_count: row.competitor_count,
    build_complexity: row.build_complexity,
    build_timeline: row.build_timeline,
    monetization_angle: row.monetization_angle,
    confidence_score: row.confidence_score,
    scores: JSON.parse((row.scores_json as string) || "{}"),
    narrative_writeup: row.narrative_writeup || "",
    validation_playbook: row.validation_playbook || "",
    gtm_strategy: row.gtm_strategy || "",
    community_signals: JSON.parse((row.community_signals_json as string) || "[]"),
    frameworks: JSON.parse((row.frameworks_json as string) || "{}"),
    source_links: JSON.parse((row.source_links_json as string) || "[]"),
    source_type: row.source_type,
    created_at: row.created_at,
    ...(scope === "saved" ? { rating: row.rating, saved_at: row.saved_at } : {}),
  }));

  const exportData = {
    exported_at: new Date().toISOString(),
    scope,
    idea_count: formatted.length,
    ideas: formatted,
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="aideapulse-export-${today}.json"`,
    },
  });
});

export { exportHandler };
