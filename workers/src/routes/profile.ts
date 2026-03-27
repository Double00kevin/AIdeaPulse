import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";

const profileHandler = new Hono<{ Bindings: Env }>();

// All routes require authentication
profileHandler.use("/*", requireAuth());

const profileSchema = z.object({
  skills: z.array(z.string().max(50)).max(10),
  budget_range: z.enum(["bootstrapped", "low", "medium", "high"]),
  niches: z.array(z.string().max(50)).max(8),
  experience_level: z.enum(["beginner", "intermediate", "advanced", "expert"]),
});

/** POST /api/profile — Save/update user profile (Pro only). */
profileHandler.post("/", async (c) => {
  const userId = c.get("userId");

  // Verify Pro subscription
  const sub = await c.env.DB.prepare(
    "SELECT plan, status FROM subscriptions WHERE user_id = ? AND plan = 'pro' AND status = 'active'",
  )
    .bind(userId)
    .first();

  if (!sub) {
    return c.json({ error: "Pro subscription required" }, 403);
  }

  // Validate body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { skills, budget_range, niches, experience_level } = parsed.data;

  await c.env.DB.prepare(
    `INSERT INTO user_profiles (user_id, skills_json, budget_range, niches_json, experience_level, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       skills_json = excluded.skills_json,
       budget_range = excluded.budget_range,
       niches_json = excluded.niches_json,
       experience_level = excluded.experience_level,
       updated_at = datetime('now')`,
  )
    .bind(userId, JSON.stringify(skills), budget_range, JSON.stringify(niches), experience_level)
    .run();

  return c.json({ ok: true });
});

/** GET /api/profile — Get current user profile. */
profileHandler.get("/", async (c) => {
  const userId = c.get("userId");

  const row = await c.env.DB.prepare(
    "SELECT skills_json, budget_range, niches_json, experience_level FROM user_profiles WHERE user_id = ?",
  )
    .bind(userId)
    .first<{ skills_json: string; budget_range: string; niches_json: string; experience_level: string }>();

  if (!row) {
    return c.json({ profile: null });
  }

  return c.json({
    profile: {
      skills: JSON.parse(row.skills_json),
      budget_range: row.budget_range,
      niches: JSON.parse(row.niches_json),
      experience_level: row.experience_level,
    },
  });
});

export { profileHandler };
