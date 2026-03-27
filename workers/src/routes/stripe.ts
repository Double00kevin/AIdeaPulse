/**
 * Stripe webhook handler for subscription events.
 * Manages subscriptions table in D1.
 */

import { Hono } from "hono";
import type { Env } from "../index";

const stripeHandler = new Hono<{ Bindings: Env }>();

/**
 * Verify Stripe webhook signature using Web Crypto API.
 * Stripe uses HMAC-SHA256 with "v1" scheme.
 */
async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = sigHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signature = parts.find((p) => p.startsWith("v1="))?.slice(3);

  if (!timestamp || !signature) return false;

  // Check timestamp freshness (5-minute tolerance)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const expected = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );

  const expectedHex = Array.from(new Uint8Array(expected))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Timing-safe comparison
  if (signature.length !== expectedHex.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return mismatch === 0;
}

/** POST /api/stripe/webhook — Handle Stripe subscription events. */
stripeHandler.post("/webhook", async (c) => {
  const stripeSecret = (c.env as any).STRIPE_WEBHOOK_SECRET;
  if (!stripeSecret) {
    return c.json({ error: "Stripe not configured" }, 500);
  }

  const sigHeader = c.req.header("stripe-signature");
  if (!sigHeader) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  const payload = await c.req.text();
  const valid = await verifyStripeSignature(payload, sigHeader, stripeSecret);
  if (!valid) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const event = JSON.parse(payload);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.clerk_user_id;
      const stripeCustomerId = session.customer;
      const subscriptionId = session.subscription;

      if (!userId) break;

      await c.env.DB.prepare(
        `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status)
         VALUES (?, ?, ?, 'pro', 'active')
         ON CONFLICT(user_id) DO UPDATE SET
           stripe_customer_id = excluded.stripe_customer_id,
           stripe_subscription_id = excluded.stripe_subscription_id,
           plan = 'pro',
           status = 'active'`,
      )
        .bind(userId, stripeCustomerId, subscriptionId)
        .run();
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      const status = sub.status === "active" ? "active" : "canceled";

      await c.env.DB.prepare(
        "UPDATE subscriptions SET status = ? WHERE stripe_subscription_id = ?",
      )
        .bind(status, sub.id)
        .run();
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await c.env.DB.prepare(
        "UPDATE subscriptions SET status = 'canceled' WHERE stripe_subscription_id = ?",
      )
        .bind(sub.id)
        .run();
      break;
    }
  }

  return c.json({ received: true });
});

export { stripeHandler };
