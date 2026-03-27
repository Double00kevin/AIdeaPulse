/**
 * Email digest route. Generates weekly digest of top ideas for subscribed users.
 * Requires RESEND_API_KEY secret to actually send emails.
 * Without it, the endpoint returns what would be sent (dry run).
 */

import { Hono } from "hono";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";

const digestHandler = new Hono<{ Bindings: Env }>();

interface DigestPrefs {
  user_id: string;
  email: string;
  frequency: string; // "weekly" | "daily" | "off"
  subscribed_at: string;
}

// ── User preferences (authenticated) ─────────────────────────────────

/** GET /api/digest/preferences — Get current user's digest preferences. */
digestHandler.get("/preferences", requireAuth(), async (c) => {
  const userId = c.get("userId");

  const prefs = await c.env.DB.prepare(
    "SELECT * FROM email_preferences WHERE user_id = ?",
  )
    .bind(userId)
    .first<DigestPrefs>();

  return c.json({
    subscribed: !!prefs && prefs.frequency !== "off",
    frequency: prefs?.frequency ?? "off",
    email: prefs?.email ?? null,
  });
});

/** POST /api/digest/preferences — Update digest preferences. */
digestHandler.post("/preferences", requireAuth(), async (c) => {
  const userId = c.get("userId");

  let body: { email?: string; frequency?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const frequency = body.frequency ?? "weekly";
  if (!["daily", "weekly", "off"].includes(frequency)) {
    return c.json({ error: "frequency must be daily, weekly, or off" }, 400);
  }

  if (!body.email && frequency !== "off") {
    return c.json({ error: "email is required to subscribe" }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO email_preferences (user_id, email, frequency)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, frequency = excluded.frequency`,
  )
    .bind(userId, body.email ?? "", frequency)
    .run();

  return c.json({ subscribed: frequency !== "off", frequency, email: body.email ?? null });
});

// ── Digest generation (called by cron or manually) ───────────────────

/** POST /api/digest/send — Generate and send digest to all subscribers.
 *  Protected by INGEST_WEBHOOK_SECRET (same secret as pipeline ingest).
 */
digestHandler.post("/send", async (c) => {
  const secret = c.req.header("X-Webhook-Secret");
  if (secret !== c.env.INGEST_WEBHOOK_SECRET) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Get subscribers
  const subscribers = await c.env.DB.prepare(
    "SELECT * FROM email_preferences WHERE frequency != 'off' AND email != ''",
  ).all<DigestPrefs>();

  const users = subscribers.results ?? [];
  if (users.length === 0) {
    return c.json({ sent: 0, message: "No subscribers" });
  }

  // Get top ideas from last 7 days
  const ideas = await c.env.DB.prepare(
    `SELECT title, one_liner, confidence_score, build_complexity, source_type, id
     FROM ideas
     WHERE created_at > datetime('now', '-7 days')
     ORDER BY confidence_score DESC
     LIMIT 10`,
  ).all();

  const topIdeas = ideas.results ?? [];
  if (topIdeas.length === 0) {
    return c.json({ sent: 0, message: "No new ideas this week" });
  }

  // Build email HTML
  const ideaRows = topIdeas
    .map(
      (idea: any) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">
            <strong>${idea.title}</strong><br>
            <span style="color:#666;font-size:13px">${idea.one_liner}</span>
          </td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-family:monospace;font-weight:bold">
            ${idea.confidence_score}
          </td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-size:12px;text-transform:uppercase">
            ${idea.source_type}
          </td>
        </tr>`,
    )
    .join("");

  const html = `
    <div style="max-width:600px;margin:0 auto;font-family:system-ui,sans-serif">
      <h2 style="margin-bottom:4px">AIdeaPulse Weekly Digest</h2>
      <p style="color:#666;margin-top:0">Top ${topIdeas.length} startup ideas this week</p>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f8f8f8">
            <th style="padding:8px;text-align:left">Idea</th>
            <th style="padding:8px;text-align:center;width:60px">Score</th>
            <th style="padding:8px;text-align:center;width:80px">Source</th>
          </tr>
        </thead>
        <tbody>${ideaRows}</tbody>
      </table>
      <p style="margin-top:16px;font-size:13px;color:#999">
        <a href="https://aideapulse.com">Browse all ideas</a> |
        <a href="https://aideapulse.com/dashboard">Manage preferences</a>
      </p>
    </div>`;

  // Check if Resend is configured
  const resendKey = (c.env as any).RESEND_API_KEY;
  if (!resendKey) {
    return c.json({
      dry_run: true,
      would_send_to: users.length,
      ideas_count: topIdeas.length,
      preview_html: html,
    });
  }

  // Send via Resend
  let sent = 0;
  for (const user of users) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "AIdeaPulse <digest@aideapulse.com>",
          to: user.email,
          subject: `AIdeaPulse: Top ${topIdeas.length} startup ideas this week`,
          html,
        }),
      });
      if (res.ok) sent++;
    } catch {
      // Log but continue sending to other users
    }
  }

  return c.json({ sent, total_subscribers: users.length, ideas_count: topIdeas.length });
});

export { digestHandler };
