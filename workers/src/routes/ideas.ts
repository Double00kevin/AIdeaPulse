import { Hono } from "hono";
import type { Env } from "../index";

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

/** GET /api/ideas — List ideas with cursor pagination and filters. */
ideasHandler.get("/", async (c) => {
  const cursor = c.req.query("cursor"); // created_at value for cursor
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 50);
  const complexity = c.req.query("complexity"); // low, medium, high
  const source = c.req.query("source"); // reddit, producthunt, google_trends
  const sort = c.req.query("sort") ?? "recent"; // recent or confidence

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

  if (sort === "confidence") {
    sql += " ORDER BY confidence_score DESC, created_at DESC";
  } else {
    sql += " ORDER BY created_at DESC";
  }

  sql += " LIMIT ?";
  bindings.push(limit + 1); // Fetch one extra to check if there's a next page

  const result = await c.env.DB.prepare(sql).bind(...bindings).all<IdeaRow>();
  const rows = result.results ?? [];

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
