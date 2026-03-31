# ADR-005: Sprint 6 AI Tools Architecture

**Date:** 2026-03-31
**Status:** Accepted
**Commits:** 1315bd3, bd2e1f8

## Context

Sprint 6 adds four AI-powered features to AIdeaPulse: Framework Analysis (pipeline batch), Validate My Idea (real-time Sonnet), AI Actions per Idea (real-time Haiku), and Idea Generator (real-time Sonnet). These features introduce a new architectural pattern: Cloudflare Workers making real-time Claude API calls, which the project hadn't done before (all prior AI calls were in the KITT pipeline).

## Decisions

### 1. Hybrid architecture (pipeline batch + real-time)

Framework Analysis runs as a 3rd pipeline stage (batch, no per-user cost). The other three features use real-time API calls from Workers (per-user, rate-limited).

**Why:** Frameworks are per-idea, not per-user, and don't need live input. Validate/Generate/Actions require user input or interaction, making batch pre-computation impossible.

### 2. @anthropic-ai/sdk instead of raw fetch

Workers use the Anthropic TypeScript SDK via the existing `nodejs_compat` flag, rather than raw `fetch()` to the REST API.

**Why:** Typed responses, automatic retries, proper error types, streaming support. Zero extra setup since `nodejs_compat` was already enabled.

### 3. Durable Objects for rate limiting (replacing D1 global limiter)

Per-feature rate limits use Durable Objects for atomic check-and-increment. The previous global rate limiter (50/day free, 1000/day Pro across ALL endpoints) was removed.

**Why:** D1 doesn't support `SELECT FOR UPDATE`, creating race conditions under concurrent requests. The global limiter was too coarse for per-feature limits with different windows (daily vs monthly). DOs provide atomic counters. Fail-open on DO unavailability to avoid blocking legitimate users.

### 4. Separate analyze_frameworks() pipeline stage

Framework analysis uses a separate Sonnet call (stage 3) rather than expanding the existing ANALYSIS_PROMPT.

**Why:** The existing prompt was already ~40 lines producing ~3K tokens of output. Adding 4 frameworks would push it to ~5K tokens, increasing truncation risk and cost by ~60%. Separate stages keep each prompt focused and independently testable.

### 5. FTS5 for similarity matching

Validate My Idea uses SQLite FTS5 virtual tables on Cloudflare D1 for finding related ideas by keyword.

**Why:** Verified via pre-sprint spike that D1 supports FTS5 (CREATE VIRTUAL TABLE, INSERT, MATCH all worked). No external embedding model or infrastructure needed. Sync triggers keep the index current with INSERT/UPDATE/DELETE on the ideas table. LIKE query fallback exists but was not needed.

### 6. Slim context injection

AI prompts include idea data as slim context (title + one_liner + scores only) rather than full idea rows, to control input token costs.

**Why:** Full idea rows (with narrative_writeup, community_signals_json) would be 50-100KB for 50 ideas, producing ~40K input tokens per Generate call. Slim context keeps calls under 5K input tokens, aligning with the $0.04/call cost estimate.

### 7. Content gating with tease-then-gate

Free users get limited access to AI features (1 validation/month, 1 action/day, see 1 generated idea) rather than full Pro gating.

**Why:** Users need to experience the value before paying. Showing confidence + Strengths for Validate, first framework score for Framework Analysis, and 1 generated idea for Generator creates upgrade triggers.

## Consequences

- Anthropic API key is now a Wrangler secret on Cloudflare (encrypted at rest)
- API costs scale with user activity: ~$0.14/day per Pro user at average use, ~$0.63/day at max limits
- At 100 Pro users, total API cost ~$14/day ($420/mo) vs $1,200/mo revenue (65% margin)
- Pipeline cost increases by ~$0.35/night for framework analysis stage
- D1 schema now has 12 migrations, 3 new tables (validations, idea_actions, generated_ideas), and 1 FTS5 virtual table
