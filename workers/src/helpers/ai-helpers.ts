/**
 * Shared AI helpers for Sprint 6 features.
 * - Anthropic SDK client creation
 * - Per-feature rate limiting via Durable Objects
 * - AI response parsing with retry
 */

import Anthropic from "@anthropic-ai/sdk";

// ── Anthropic Client ─────────────────────────────────────────────

export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

// ── Input Sanitization ───────────────────────────────────────────

const HTML_TAG_RE = /<[^>]*>/g;

export function sanitizeUserInput(input: string, maxLength = 500): string {
  let text = input
    .replace(HTML_TAG_RE, "") // strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") // strip control chars (keep \n, \r, \t)
    .normalize("NFC"); // unicode normalization

  // collapse excessive newlines (max 5)
  const lines = text.split("\n");
  if (lines.length > 5) {
    text = lines.slice(0, 5).join("\n");
  }

  return text.slice(0, maxLength).trim();
}

// ── AI Response Parsing ──────────────────────────────────────────

export function parseAIJsonResponse<T>(raw: string): T {
  let text = raw.trim();

  // Strip markdown code fences
  if (text.startsWith("```")) {
    text = text.split("\n", 1).length > 1
      ? text.slice(text.indexOf("\n") + 1)
      : text.slice(3);
    if (text.endsWith("```")) {
      text = text.slice(0, -3).trim();
    }
  }

  return JSON.parse(text) as T;
}

// ── Feature Rate Limiting (via Durable Objects) ──────────────────

export interface RateLimitConfig {
  feature: string;
  freeLimit: number;
  proLimit: number;
  /** "day" resets at UTC midnight, "month" resets on 1st of each month */
  window: "day" | "month";
}

export function getRateLimitKey(userId: string, feature: string, window: "day" | "month"): string {
  const now = new Date();
  if (window === "month") {
    return `${userId}:${feature}:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return `${userId}:${feature}:${now.toISOString().slice(0, 10)}`;
}
