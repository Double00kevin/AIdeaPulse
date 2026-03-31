/**
 * POST /api/ideas/:id/actions — AI Actions "Deep Dive" endpoint (Sprint 6, Phase 6B)
 *
 * Structured prompt templates that leverage idea data for on-demand AI analysis.
 * Uses Haiku for fast, cheap responses. Results cached in D1 for 24h.
 *
 * Rate limits: Free = 1/day, Pro = 30/day
 */

import { Hono } from "hono";
import { optionalAuth } from "../middleware/auth";
import {
  createAnthropicClient,
  parseAIJsonResponse,
  getRateLimitKey,
} from "../helpers/ai-helpers";
import { checkAndIncrementRateLimit } from "../rate-limiter-do";

interface Env {
  DB: D1Database;
  RATE_LIMITER: DurableObjectNamespace;
  ANTHROPIC_API_KEY: string;
}

const ACTION_TYPES = {
  market_opportunity: {
    label: "Deep dive: market opportunity",
    prompt: `Analyze the market opportunity for this startup idea. Cover: market size reality check, competitive gaps, timing factors, and whether the demand signals justify building this. Reference the community signals provided. Be specific with numbers.`,
  },
  technical_feasibility: {
    label: "How hard to build solo?",
    prompt: `Assess the technical feasibility for a solo developer building this as a side project. Cover: tech stack recommendation, MVP scope (what to build first weekend), infrastructure costs estimate, and specific technical risks. Be practical — assume the builder has a day job and codes nights/weekends.`,
  },
  revenue_model: {
    label: "Revenue model breakdown",
    prompt: `Design a revenue model for this idea. Cover: pricing tiers (free/paid/enterprise), what to gate behind each tier, expected conversion rates based on similar products, and projected MRR at 100/1000/10000 users. Name specific comparable products and their pricing.`,
  },
  weekend_plan: {
    label: "Weekend build plan",
    prompt: `Create a step-by-step weekend build plan for this idea. Cover: Saturday morning (setup + core feature), Saturday afternoon (UI + basic flow), Sunday morning (polish + deploy), Sunday afternoon (launch channels + first users). Be specific about tools, frameworks, and deployment targets. Assume the builder knows React/Node.`,
  },
  competitors: {
    label: "Competitor landscape",
    prompt: `Map the competitive landscape for this idea. For each competitor: name, pricing, strengths, weaknesses, and what gap this idea fills that they don't. Include both direct competitors and adjacent tools people use as workarounds. Reference the community signals for what users actually complain about.`,
  },
} as const;

type ActionType = keyof typeof ACTION_TYPES;

function buildActionPrompt(action: ActionType, idea: any): string {
  const template = ACTION_TYPES[action];
  return `${template.prompt}

Idea: ${idea.title}${idea.product_name ? ` (${idea.product_name})` : ""}
One-liner: ${idea.one_liner}
Problem: ${idea.problem_statement}
Target audience: ${idea.target_audience}
Build complexity: ${idea.build_complexity}
Competitors: ${(idea.competitors || []).join(", ")}
Monetization: ${idea.monetization_angle}
Confidence: ${idea.confidence_score}/100

Community signals:
${(idea.community_signals || []).map((s: any) => `- [${s.source}] ${s.title} (${JSON.stringify(s.engagement || {})})`).join("\n")}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "summary": "2-3 sentence executive summary",
  "details": ["Point 1 with specifics", "Point 2 with specifics", "Point 3 with specifics", "Point 4 with specifics"],
  "signal_references": "One sentence noting which community signals informed this analysis"
}`;
}

export const actionsHandler = new Hono<{ Bindings: Env }>();

actionsHandler.post("/:id/actions", optionalAuth(), async (c) => {
  const userId = c.get("userId") as string | undefined;
  const ideaId = c.req.param("id");

  if (!userId) {
    return c.json({ error: "Sign in to use AI Actions" }, 401);
  }

  // Parse action type
  const body = await c.req.json<{ action?: string }>().catch(() => null);
  const actionType = body?.action as ActionType | undefined;

  if (!actionType || !(actionType in ACTION_TYPES)) {
    return c.json({
      error: "Invalid action type",
      valid_actions: Object.keys(ACTION_TYPES),
    }, 400);
  }

  // Check subscription tier
  const sub = await c.env.DB.prepare(
    "SELECT plan, status FROM subscriptions WHERE user_id = ? AND status = 'active'",
  )
    .bind(userId)
    .first<{ plan: string; status: string }>();

  const isPro = sub?.plan === "pro";
  const limit = isPro ? 30 : 1;
  const key = getRateLimitKey(userId, "actions", "day");

  const rateLimitResult = await checkAndIncrementRateLimit(
    c.env.RATE_LIMITER,
    key,
    limit,
  );

  if (!rateLimitResult.allowed) {
    return c.json({
      error: isPro ? "Daily action limit reached (30/day)" : "Free users get 1 AI action per day",
      remaining: 0,
      upgrade: !isPro,
    }, 429);
  }

  // Fetch the idea
  const idea = await c.env.DB.prepare(
    `SELECT id, title, one_liner, problem_statement, target_audience,
            build_complexity, competitors_json, monetization_angle,
            confidence_score, community_signals_json, product_name
     FROM ideas WHERE id = ?`,
  )
    .bind(ideaId)
    .first<any>();

  if (!idea) {
    return c.json({ error: "Idea not found" }, 404);
  }

  // Parse JSON fields
  idea.competitors = JSON.parse(idea.competitors_json || "[]");
  idea.community_signals = JSON.parse(idea.community_signals_json || "[]");

  // Check cache (24h TTL)
  const cached = await c.env.DB.prepare(
    `SELECT response_json, created_at FROM idea_actions
     WHERE idea_id = ? AND action_type = ?
     AND created_at > datetime('now', '-24 hours')
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(ideaId, actionType)
    .first<{ response_json: string; created_at: string }>();

  if (cached) {
    return c.json({
      action: actionType,
      label: ACTION_TYPES[actionType].label,
      cached: true,
      ...JSON.parse(cached.response_json),
      remaining: rateLimitResult.remaining,
    });
  }

  // Call Haiku via Anthropic SDK
  try {
    const client = createAnthropicClient(c.env.ANTHROPIC_API_KEY);
    const prompt = buildActionPrompt(actionType, idea);

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    let result: any;

    try {
      result = parseAIJsonResponse(rawText);
    } catch {
      // Retry once
      const retry = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      });
      const retryText = retry.content[0].type === "text" ? retry.content[0].text : "";
      result = parseAIJsonResponse(retryText);
    }

    // Cache in D1
    await c.env.DB.prepare(
      `INSERT INTO idea_actions (idea_id, action_type, response_json, created_at, expires_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now', '+24 hours'))`,
    )
      .bind(ideaId, actionType, JSON.stringify(result))
      .run();

    return c.json({
      action: actionType,
      label: ACTION_TYPES[actionType].label,
      cached: false,
      ...result,
      remaining: rateLimitResult.remaining,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("rate_limit") || errMsg.includes("429")) {
      return c.json({ error: "AI is busy, try again in a moment" }, 503);
    }
    console.error("Actions error:", errMsg);
    return c.json({ error: "Analysis temporarily unavailable" }, 502);
  }
});
