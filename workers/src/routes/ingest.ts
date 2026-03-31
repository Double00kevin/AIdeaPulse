import { Hono } from "hono";
import type { Env } from "../index";

const ingestHandler = new Hono<{ Bindings: Env }>();

/**
 * Verify HMAC-SHA256 signature using timing-safe comparison.
 * Signature = HMAC(secret, body). Timestamp must be within 5 minutes.
 */
async function verifySignature(
  body: ArrayBuffer,
  signature: string,
  timestamp: string,
  secret: string,
): Promise<{ valid: boolean; reason?: string }> {
  // Check timestamp freshness (5-minute window)
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    return { valid: false, reason: "Stale or invalid timestamp" };
  }

  // Compute expected HMAC
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const expectedSig = await crypto.subtle.sign("HMAC", key, body);
  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Timing-safe comparison
  if (signature.length !== expectedHex.length) {
    return { valid: false, reason: "Invalid signature" };
  }

  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }

  if (mismatch !== 0) {
    return { valid: false, reason: "Invalid signature" };
  }

  return { valid: true };
}

/** Normalize title for dedup: lowercase, trim, collapse whitespace. */
function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Fuzzy dedup: check if a normalized title is too similar to existing ones.
 * Uses word-set overlap (Jaccard similarity > 0.85 = duplicate).
 */
function wordSetSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(" "));
  const setB = new Set(b.split(" "));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

interface IdeaPayload {
  title: string;
  one_liner: string;
  problem_statement?: string;
  target_audience?: string;
  market_size?: { tam?: string; sam?: string; som?: string };
  competitors?: string[];
  competitor_count?: number;
  build_complexity?: string;
  build_timeline?: string;
  monetization_angle?: string;
  confidence_score?: number;
  source_links?: string[];
  source_type?: string;
  // Sprint 5: Rich narratives
  narrative_writeup?: string;
  product_name?: string;
  validation_playbook?: string;
  gtm_strategy?: string;
  // Sprint 5: Multi-dimensional scores
  scores?: Record<string, number>;
  // Sprint 5: Community signals
  community_signals?: object[];
  // Sprint 6: Framework analysis (array of {label, framework, score, explanation})
  frameworks?: object[] | Record<string, unknown>;
}

ingestHandler.post("/", async (c) => {
  const signature = c.req.header("X-Webhook-Signature");
  const timestamp = c.req.header("X-Webhook-Timestamp");

  if (!signature || !timestamp) {
    return c.json({ error: "Missing auth headers" }, 401);
  }

  const bodyBuffer = await c.req.arrayBuffer();
  const result = await verifySignature(
    bodyBuffer,
    signature,
    timestamp,
    c.env.INGEST_WEBHOOK_SECRET,
  );

  if (!result.valid) {
    return c.json({ error: result.reason }, 401);
  }

  let payload: { ideas: IdeaPayload[]; timestamp: number };
  try {
    payload = JSON.parse(new TextDecoder().decode(bodyBuffer));
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (!Array.isArray(payload.ideas)) {
    return c.json({ error: "Missing ideas array" }, 400);
  }

  // Fetch existing titles for fuzzy dedup
  const existingRows = await c.env.DB.prepare(
    "SELECT title_normalized FROM ideas",
  ).all<{ title_normalized: string }>();
  const existingTitles = existingRows.results?.map((r) => r.title_normalized) ?? [];

  let inserted = 0;
  let skipped = 0;

  for (const idea of payload.ideas) {
    if (!idea.title || !idea.one_liner) {
      skipped++;
      continue;
    }

    const normalized = normalizeTitle(idea.title);

    // Fuzzy dedup against existing titles
    const isDuplicate = existingTitles.some(
      (existing) => wordSetSimilarity(normalized, existing) > 0.85,
    );
    if (isDuplicate) {
      skipped++;
      continue;
    }

    const id = crypto.randomUUID();

    try {
      await c.env.DB.prepare(
        `INSERT OR IGNORE INTO ideas
         (id, title, title_normalized, one_liner, problem_statement,
          target_audience, market_size_json, competitors_json, competitor_count,
          build_complexity, build_timeline, monetization_angle,
          confidence_score, source_links_json, source_type,
          narrative_writeup, product_name, validation_playbook, gtm_strategy,
          scores_json, community_signals_json, frameworks_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          idea.title,
          normalized,
          idea.one_liner,
          idea.problem_statement ?? "",
          idea.target_audience ?? "",
          JSON.stringify(idea.market_size ?? {}),
          JSON.stringify(idea.competitors ?? []),
          idea.competitor_count ?? (idea.competitors?.length ?? 0),
          idea.build_complexity ?? "medium",
          idea.build_timeline ?? "",
          idea.monetization_angle ?? "",
          idea.confidence_score ?? 0,
          JSON.stringify(idea.source_links ?? []),
          idea.source_type ?? "reddit",
          idea.narrative_writeup ?? "",
          idea.product_name ?? "",
          idea.validation_playbook ?? "",
          idea.gtm_strategy ?? "",
          JSON.stringify(idea.scores ?? {}),
          JSON.stringify(idea.community_signals ?? []),
          JSON.stringify(idea.frameworks ?? {}),
        )
        .run();

      // Add to existing titles for within-batch dedup
      existingTitles.push(normalized);
      inserted++;
    } catch (e) {
      // UNIQUE constraint violation = duplicate, skip silently
      skipped++;
    }
  }

  return c.json({ inserted, skipped, total: payload.ideas.length });
});

export { ingestHandler };
