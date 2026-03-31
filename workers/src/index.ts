import { Hono } from "hono";
import { cors } from "hono/cors";
import { ingestHandler } from "./routes/ingest";
import { ideasHandler } from "./routes/ideas";
import { savedHandler } from "./routes/saved";
import { profileHandler } from "./routes/profile";
import { digestHandler } from "./routes/digest";
import { stripeHandler } from "./routes/stripe";
import { healthHandler } from "./routes/health";
import { ogHandler } from "./routes/og";
import { trendsHandler } from "./routes/trends";
import { exportHandler } from "./routes/export";
import { validateHandler } from "./routes/validate";
import { requireAuth } from "./middleware/auth";

// Re-export Durable Object class for Cloudflare runtime
export { RateLimiterDO } from "./rate-limiter-do";

export interface Env {
  DB: D1Database;
  RATE_LIMITER: DurableObjectNamespace;
  INGEST_WEBHOOK_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID: string;
  ANTHROPIC_API_KEY: string;
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS for frontend
app.use("/api/*", cors({
  origin: ["https://aideapulse.com", "https://www.aideapulse.com", "https://aideapulse-site.pages.dev"],
  allowMethods: ["GET", "POST", "DELETE"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Routes
app.route("/api/ingest", ingestHandler);
app.route("/api/ideas", ideasHandler);
app.route("/api/saved", savedHandler);
app.route("/api/profile", profileHandler);
app.route("/api/digest", digestHandler);
app.route("/api/stripe", stripeHandler);
app.route("/api/health", healthHandler);
app.route("/api/og", ogHandler);
app.route("/api/trends", trendsHandler);
app.route("/api/export", exportHandler);
app.route("/api/validate", validateHandler);

// Subscription status check (authenticated)
app.get("/api/subscription", requireAuth(), async (c) => {
  const userId = c.get("userId");
  const sub = await c.env.DB.prepare(
    "SELECT plan, status FROM subscriptions WHERE user_id = ? AND status = 'active'",
  )
    .bind(userId)
    .first<{ plan: string; status: string }>();

  return c.json({
    plan: sub?.plan ?? "free",
    active: !!sub,
  });
});

// Catch-all 404
app.all("*", (c) => c.json({ error: "Not found" }, 404));

export default app;
