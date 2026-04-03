/**
 * POST /api/generate — Idea Generator endpoint (Sprint 6, Phase 6B)
 *
 * Generates personalized startup ideas based on user's Smart Match profile,
 * cross-referenced against existing ideas in the database for dedup.
 *
 * Rate limits: Free = see 1 idea (blur rest), Pro = 5/day
 */

import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
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
  CF_AIG_TOKEN: string;
}

interface GeneratedIdea {
  name: string;
  description: string;
  fit_score: number;
  matched_signals: string;
  why_this_fits: string;
}

const GENERATE_SYSTEM_PROMPT = `You are a startup idea generator for AIdeaPulse. Generate 3 personalized startup ideas based on the user's profile and real demand signals from our database.

Each idea must:
- Match the user's skills and tech stack
- Fit within their budget range
- Align with their niche interests
- Be grounded in real demand signals from the database (not hypothetical)
- NOT duplicate any existing ideas listed in the database context

Return ONLY valid JSON (no markdown, no code fences):
[
  {
    "name": "Creative product name",
    "description": "2-3 sentence description of what it does and who it's for",
    "fit_score": 0-100,
    "matched_signals": "Which signals from the database inspired this idea",
    "why_this_fits": "One sentence on why this matches the user's specific profile"
  },
  ...
]

Score fit_score based on: skill match (can they build it?), budget match (can they afford it?), niche match (does it align with their interests?), complexity match (appropriate for their experience level?).`;

export const generateHandler = new Hono<{ Bindings: Env }>();

generateHandler.post("/", requireAuth(), async (c) => {
  const userId = c.get("userId") as string;

  // Check subscription tier
  const sub = await c.env.DB.prepare(
    "SELECT plan, status FROM subscriptions WHERE user_id = ? AND status = 'active'",
  )
    .bind(userId)
    .first<{ plan: string; status: string }>();

  const isPro = sub?.plan === "pro";

  // Rate limit
  const limit = isPro ? 5 : 1;
  const key = getRateLimitKey(userId, "generate", "day");

  const rateLimitResult = await checkAndIncrementRateLimit(
    c.env.RATE_LIMITER,
    key,
    limit,
  );

  if (!rateLimitResult.allowed) {
    return c.json({
      error: isPro ? "Daily generation limit reached (5/day)" : "Free users get 1 generation per day",
      remaining: 0,
      upgrade: !isPro,
    }, 429);
  }

  // Load user profile
  const profile = await c.env.DB.prepare(
    "SELECT skills_json, budget_range, niches_json, experience_level FROM user_profiles WHERE user_id = ?",
  )
    .bind(userId)
    .first<{ skills_json: string; budget_range: string; niches_json: string; experience_level: string }>();

  if (!profile) {
    return c.json({
      error: "Set up your Smart Match profile first",
      redirect: "/dashboard",
    }, 400);
  }

  const skills = JSON.parse(profile.skills_json || "[]");
  const niches = JSON.parse(profile.niches_json || "[]");

  // Load top 50 ideas (slim context) for dedup + grounding
  const existingIdeas = await c.env.DB.prepare(
    `SELECT title, one_liner, confidence_score, source_type
     FROM ideas
     ORDER BY confidence_score DESC
     LIMIT 50`,
  )
    .all<{ title: string; one_liner: string; confidence_score: number; source_type: string }>();

  const dbContext = (existingIdeas.results ?? [])
    .map((i) => `- ${i.title} (${i.source_type}, score: ${i.confidence_score}): ${i.one_liner}`)
    .join("\n");

  const userMessage = `User profile:
- Skills: ${skills.join(", ") || "not specified"}
- Budget: ${profile.budget_range || "not specified"}
- Interests: ${niches.join(", ") || "not specified"}
- Experience: ${profile.experience_level || "not specified"}

Existing ideas in our database (DO NOT duplicate these):
${dbContext}

Generate 3 new ideas that fit this profile and are grounded in the demand signals above.`;

  try {
    const client = createAnthropicClient(c.env.ANTHROPIC_API_KEY, c.env.CF_AIG_TOKEN);

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: GENERATE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    let ideas: GeneratedIdea[];

    try {
      ideas = parseAIJsonResponse<GeneratedIdea[]>(rawText);
    } catch {
      const retry = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: GENERATE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });
      const retryText = retry.content[0].type === "text" ? retry.content[0].text : "";
      ideas = parseAIJsonResponse<GeneratedIdea[]>(retryText);
    }

    // Clamp fit scores
    ideas = ideas.map((idea) => ({
      ...idea,
      fit_score: Math.max(0, Math.min(100, Math.round(idea.fit_score))),
    }));

    // Store in D1
    await c.env.DB.prepare(
      `INSERT INTO generated_ideas (user_id, ideas_json, created_at)
       VALUES (?, ?, datetime('now'))`,
    )
      .bind(userId, JSON.stringify(ideas))
      .run();

    // Content gating: free users see 1 idea, rest blurred
    if (!isPro) {
      return c.json({
        tier: "free",
        ideas: [ideas[0]],
        locked_count: Math.max(0, ideas.length - 1),
        upgrade: true,
        remaining: rateLimitResult.remaining,
        profile: { skills, niches, budget_range: profile.budget_range, experience_level: profile.experience_level },
      });
    }

    return c.json({
      tier: "pro",
      ideas,
      remaining: rateLimitResult.remaining,
      profile: { skills, niches, budget_range: profile.budget_range, experience_level: profile.experience_level },
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("rate_limit") || errMsg.includes("429")) {
      return c.json({ error: "AI is busy, try again in a moment" }, 503);
    }
    console.error("Generate error:", errMsg);
    return c.json({ error: "Generation temporarily unavailable" }, 502);
  }
});
