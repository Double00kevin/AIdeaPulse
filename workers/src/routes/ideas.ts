import { Hono } from "hono";
import type { Env } from "../index";
import { optionalAuth } from "../middleware/auth";
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
  // Sprint 5 additions
  narrative_writeup: string;
  product_name: string;
  validation_playbook: string;
  gtm_strategy: string;
  scores_json: string;
  community_signals_json: string;
  frameworks_json: string;
}

type Tier = "anon" | "free" | "pro";

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
    // Sprint 5 fields
    narrative_writeup: row.narrative_writeup || "",
    product_name: row.product_name || "",
    validation_playbook: row.validation_playbook || "",
    gtm_strategy: row.gtm_strategy || "",
    scores: JSON.parse(row.scores_json || "{}"),
    community_signals: JSON.parse(row.community_signals_json || "[]"),
    frameworks: JSON.parse(row.frameworks_json || "{}"),
  };
}

/** Strip idea to public-safe fields for anon/free list views. */
export function stripIdeaFields(idea: ReturnType<typeof formatIdea>) {
  return {
    id: idea.id,
    title: idea.title,
    source_type: idea.source_type,
    confidence_score: idea.confidence_score,
    created_at: idea.created_at,
    build_complexity: idea.build_complexity,
  };
}

/** Teaser fields for free users viewing a gated detail page. */
export function teaserIdeaFields(idea: ReturnType<typeof formatIdea>) {
  return {
    ...stripIdeaFields(idea),
    one_liner: idea.one_liner,
    product_name: idea.product_name,
    signal_count: idea.community_signals.length,
  };
}

/**
 * Determine subscription tier from userId.
 * Returns "anon" if no userId, "pro" if active pro subscription, "free" otherwise.
 */
export async function getUserTier(userId: string | undefined, db: D1Database): Promise<Tier> {
  if (!userId) return "anon";

  const sub = await db
    .prepare(
      "SELECT plan FROM subscriptions WHERE user_id = ? AND plan = 'pro' AND status = 'active'",
    )
    .bind(userId)
    .first();

  return sub ? "pro" : "free";
}

/**
 * Get the effective claim date using 06:00 UTC as the day boundary.
 * If current UTC hour < 6, the "day" is still yesterday.
 */
export function getClaimDate(now?: Date): string {
  const d = now ?? new Date();
  const adjusted = new Date(d.getTime() - 6 * 60 * 60 * 1000);
  return adjusted.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Check if user has already claimed a free idea today. Returns the idea_id or null. */
export async function getDailyClaim(
  userId: string,
  db: D1Database,
  now?: Date,
): Promise<string | null> {
  const claimDate = getClaimDate(now);
  const row = await db
    .prepare("SELECT idea_id FROM daily_free_claims WHERE user_id = ? AND claimed_date = ?")
    .bind(userId, claimDate)
    .first<{ idea_id: string }>();
  return row?.idea_id ?? null;
}

/** Insert a daily free claim. Returns true on success. */
export async function insertDailyClaim(
  userId: string,
  ideaId: string,
  db: D1Database,
  now?: Date,
): Promise<boolean> {
  const claimDate = getClaimDate(now);
  try {
    await db
      .prepare(
        "INSERT INTO daily_free_claims (user_id, idea_id, claimed_date) VALUES (?, ?, ?)",
      )
      .bind(userId, ideaId, claimDate)
      .run();
    return true;
  } catch {
    // Conflict — already claimed today (race condition safety)
    return false;
  }
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

/** GET /api/ideas — List ideas with cursor pagination, filters, and tier-based gating. */
ideasHandler.get("/", optionalAuth(), async (c) => {
  const cursor = c.req.query("cursor"); // created_at value for cursor
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 50);
  const complexity = c.req.query("complexity"); // low, medium, high
  const source = c.req.query("source"); // reddit, producthunt, google_trends
  const sort = c.req.query("sort") ?? "recent"; // recent or confidence
  const smartMatch = c.req.query("smart_match") === "true";

  const userId: string | undefined = c.get("userId");
  const tier = await getUserTier(userId, c.env.DB);

  // Smart match: only for Pro users with a profile
  let profile: UserProfile | null = null;
  if (smartMatch && tier === "pro") {
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

  // Pro + Smart Match path — return full data with fit scores
  if (applySmartMatch) {
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
      tier,
    });
  }

  // Standard pagination
  const hasMore = rows.length > limit;
  const allIdeas = rows.slice(0, limit).map(formatIdea);
  const nextCursor = hasMore ? allIdeas[allIdeas.length - 1]?.created_at : null;

  // Pro users — return full data
  if (tier === "pro") {
    return c.json({
      ideas: allIdeas,
      next_cursor: nextCursor,
      has_more: hasMore,
      tier,
    });
  }

  // Free users — stripped fields, except the daily claimed idea gets full data
  if (tier === "free") {
    const dailyFreeIdeaId = await getDailyClaim(userId!, c.env.DB);

    const ideas = allIdeas.map((idea) => {
      if (dailyFreeIdeaId && idea.id === dailyFreeIdeaId) {
        return idea; // Full data for claimed idea
      }
      return stripIdeaFields(idea);
    });

    return c.json({
      ideas,
      next_cursor: nextCursor,
      has_more: hasMore,
      tier,
      daily_free_idea_id: dailyFreeIdeaId,
    });
  }

  // Anon users — stripped fields only
  return c.json({
    ideas: allIdeas.map(stripIdeaFields),
    next_cursor: nextCursor,
    has_more: hasMore,
    tier,
  });
});

/** GET /api/ideas/:id — Get a single idea by ID with tier-based gating. */
ideasHandler.get("/:id", optionalAuth(), async (c) => {
  const id = c.req.param("id");

  const result = await c.env.DB.prepare(
    "SELECT * FROM ideas WHERE id = ?",
  )
    .bind(id)
    .first<IdeaRow>();

  if (!result) {
    return c.json({ error: "Idea not found" }, 404);
  }

  const idea = formatIdea(result);
  const userId: string | undefined = c.get("userId");
  const tier = await getUserTier(userId, c.env.DB);

  // Pro — full access
  if (tier === "pro") {
    return c.json(idea);
  }

  // Free — check/create daily claim
  if (tier === "free") {
    const existingClaim = await getDailyClaim(userId!, c.env.DB);

    if (existingClaim === id) {
      // Already claimed this idea — return full data
      return c.json(idea);
    }

    if (!existingClaim) {
      // No claim today — this idea becomes the daily free claim
      await insertDailyClaim(userId!, id, c.env.DB);
      return c.json(idea);
    }

    // Already claimed a different idea today — gated
    return c.json({
      ...teaserIdeaFields(idea),
      gated: true,
      upgrade_url: "/pro",
    });
  }

  // Anon — teaser only
  return c.json({
    ...teaserIdeaFields(idea),
    gated: true,
    signup_required: true,
  });
});

export { ideasHandler };
