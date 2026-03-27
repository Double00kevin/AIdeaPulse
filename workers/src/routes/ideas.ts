import { Hono } from "hono";
import type { Env } from "../index";
import { verifyClerkToken } from "../middleware/auth";
import { calculateFitScore, type UserProfile, type IdeaForScoring } from "../scoring/fitScore";

const ideasHandler = new Hono<{ Bindings: Env }>();

interface IdeaRow {
  id: string;
  title: string;
  one_liner: string;
  problem_statement: string;
  target_audience: string;
  market_size_json: string;
  competitors_json: string;
  competitor_count: number;
  build_complexity: string;
  build_timeline: string;
  monetization_angle: string;
  confidence_score: number;
  source_links_json: string;
  source_type: string;
  created_at: string;
}

function formatIdea(row: IdeaRow) {
  return {
    id: row.id,
    title: row.title,
    one_liner: row.one_liner,
    problem_statement: row.problem_statement,
    target_audience: row.target_audience,
    market_size: JSON.parse(row.market_size_json || "{}"),
    competitors: JSON.parse(row.competitors_json || "[]"),
    competitor_count: row.competitor_count,
    build_complexity: row.build_complexity,
    build_timeline: row.build_timeline,
    monetization_angle: row.monetization_angle,
    confidence_score: row.confidence_score,
    source_links: JSON.parse(row.source_links_json || "[]"),
    source_type: row.source_type,
    created_at: row.created_at,
  };
}

/**
 * Try to load the user profile for smart match scoring.
 * Returns null silently if any step fails (no auth, no pro, no profile).
 */
async function tryLoadProfile(
  authHeader: string | undefined,
  db: D1Database,
): Promise<UserProfile | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  let userId: string;
  try {
    const payload = await verifyClerkToken(authHeader.slice(7));
    userId = payload.sub;
  } catch {
    return null;
  }

  // Check pro subscription
  const sub = await db
    .prepare(
      "SELECT plan FROM subscriptions WHERE user_id = ? AND plan = 'pro' AND status = 'active'",
    )
    .bind(userId)
    .first();
  if (!sub) return null;

  // Load profile
  const row = await db
    .prepare(
      "SELECT skills_json, budget_range, niches_json, experience_level FROM user_profiles WHERE user_id = ?",
    )
    .bind(userId)
    .first<{
      skills_json: string;
      budget_range: string;
      niches_json: string;
      experience_level: string;
    }>();
  if (!row) return null;

  return {
    skills: JSON.parse(row.skills_json),
    budget_range: row.budget_range as UserProfile["budget_range"],
    niches: JSON.parse(row.niches_json),
    experience_level: row.experience_level as UserProfile["experience_level"],
  };
}

/** GET /api/ideas — List ideas with cursor pagination and filters. */
ideasHandler.get("/", async (c) => {
  const cursor = c.req.query("cursor"); // created_at value for cursor
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 50);
  const complexity = c.req.query("complexity"); // low, medium, high
  const source = c.req.query("source"); // reddit, producthunt, google_trends
  const sort = c.req.query("sort") ?? "recent"; // recent or confidence
  const smartMatch = c.req.query("smart_match") === "true";

  // Attempt to load profile for smart match (non-blocking)
  let profile: UserProfile | null = null;
  if (smartMatch) {
    profile = await tryLoadProfile(c.req.header("Authorization"), c.env.DB);
  }
  const applySmartMatch = smartMatch && profile !== null;

  let sql = "SELECT * FROM ideas WHERE 1=1";
  const bindings: (string | number)[] = [];

  if (cursor) {
    sql += " AND created_at < ?";
    bindings.push(cursor);
  }

  if (complexity && ["low", "medium", "high"].includes(complexity)) {
    sql += " AND build_complexity = ?";
    bindings.push(complexity);
  }

  const validSources = [
    "reddit", "producthunt", "google_trends",
    "hackernews", "github_trending", "devto", "lobsters", "newsapi",
  ];
  if (source && validSources.includes(source)) {
    sql += " AND source_type = ?";
    bindings.push(source);
  }

  // When smart match is active, fetch more rows to sort client-side by fit_score.
  // Otherwise use the normal DB sort.
  if (!applySmartMatch) {
    if (sort === "confidence") {
      sql += " ORDER BY confidence_score DESC, created_at DESC";
    } else {
      sql += " ORDER BY created_at DESC";
    }
    sql += " LIMIT ?";
    bindings.push(limit + 1);
  } else {
    // Fetch a larger window to score and re-sort
    sql += " ORDER BY created_at DESC LIMIT ?";
    bindings.push(Math.max(limit * 3, 60));
  }

  const result = await c.env.DB.prepare(sql).bind(...bindings).all<IdeaRow>();
  const rows = result.results ?? [];

  if (applySmartMatch) {
    // Score each idea and sort by fit_score
    const scored = rows.map((row) => {
      const formatted = formatIdea(row);
      const ideaForScoring: IdeaForScoring = {
        title: formatted.title,
        one_liner: formatted.one_liner,
        problem_statement: formatted.problem_statement,
        target_audience: formatted.target_audience,
        build_complexity: formatted.build_complexity as IdeaForScoring["build_complexity"],
        monetization_angle: formatted.monetization_angle,
        source_type: formatted.source_type,
        competitors: formatted.competitors,
      };
      const { fit_score, fit_reason } = calculateFitScore(profile!, ideaForScoring);
      return { ...formatted, fit_score, fit_reason };
    });

    scored.sort((a, b) =>
      b.fit_score - a.fit_score || b.confidence_score - a.confidence_score,
    );

    const sliced = scored.slice(0, limit);
    const hasMore = scored.length > limit;
    const nextCursor = hasMore ? sliced[sliced.length - 1]?.created_at : null;

    return c.json({
      ideas: sliced,
      next_cursor: nextCursor,
      has_more: hasMore,
    });
  }

  // Normal (non-smart-match) response
  const hasMore = rows.length > limit;
  const ideas = rows.slice(0, limit).map(formatIdea);
  const nextCursor = hasMore ? ideas[ideas.length - 1]?.created_at : null;

  return c.json({
    ideas,
    next_cursor: nextCursor,
    has_more: hasMore,
  });
});

/** GET /api/ideas/:id — Get a single idea by ID. */
ideasHandler.get("/:id", async (c) => {
  const id = c.req.param("id");

  const result = await c.env.DB.prepare(
    "SELECT * FROM ideas WHERE id = ?",
  )
    .bind(id)
    .first<IdeaRow>();

  if (!result) {
    return c.json({ error: "Idea not found" }, 404);
  }

  return c.json(formatIdea(result));
});

export { ideasHandler };
