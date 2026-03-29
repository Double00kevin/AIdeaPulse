# ADR-004: Content Gating — Three-Tier Visibility Model

**Date:** 2026-03-27
**Status:** Accepted
**Author:** Kevin Hillis
**Sprint:** Sprint 4 (pre-launch)

---

## Context

AIdeaPulse currently returns full idea data to all users regardless of auth state. With Stripe wired and Pro tier at $12/mo, we need a content gating strategy that drives signups and conversions without killing SEO discoverability. The pipeline generates ~60 ideas/day and the archive grows indefinitely.

## Decision

Three tiers of content visibility:

### Anonymous (not signed in)
- See all idea titles + category + source + date in the feed
- Publicly crawlable for SEO
- Clicking any idea triggers a sign-up wall
- No full idea details exposed

### Free (signed in, no subscription)
- See all idea titles in full archive
- 1 complete idea per day — first-click claims it, tracked in D1 as `daily_free_claims` (user_id, idea_id, claimed_date, UTC)
- Gated ideas show title + first sentence of analysis as teaser + "Upgrade to Pro" CTA
- Daily claim resets at 06:00 UTC (aligned with pipeline run)
- Email digests: titles-only daily digest (retention + conversion lever)

### Pro ($12/mo)
- Full details on every idea, full historical archive
- Smart Match (ADR-003)
- Full email digests with complete analysis

## Implementation Scope

### D1 Schema
New `daily_free_claims` table:
- `user_id` TEXT
- `idea_id` TEXT
- `claimed_date` TEXT (YYYY-MM-DD, UTC)
- PRIMARY KEY: (user_id, claimed_date) — one claim per user per day

### Workers API
- Response shaping middleware: strip analysis fields for free/anon, serve full payload for Pro and claimed daily free idea
- Public list endpoint (cacheable, titles only) vs authenticated detail endpoint (per-user, not cached)
- New endpoint or logic: claim daily free idea (POST, checks if already claimed today)
- Fields exposed per tier:
  - **Anon/Free list:** id, title, category, source, created_at, confidence_score (number only)
  - **Free claimed + Pro:** all fields (analysis, market_size, competition, recommendations, etc.)
  - **Free gated detail:** above list fields + first sentence of analysis as teaser

### Frontend
- Three card states: locked (anon → sign-up CTA), gated (free → upgrade CTA with teaser), full (Pro or claimed)
- Blur/lock visual treatment on gated cards
- "You've used your free idea today" indicator after claim

### Shareable URLs
- `/idea/:id` renders public preview (title + teaser + OG image) for non-users
- Preserves viral sharing loop — Pro user shares on Twitter, anonymous visitor sees enough to want to sign up

### Email Digests
- Free tier: titles-only daily digest to drive retention and conversion
- Pro tier: full analysis in digest

## Consequences

- **SEO benefit:** Publicly crawlable titles drive organic discovery
- **Clear value ladder:** anonymous → free → Pro with visible upgrade pressure at each tier
- **Additional D1 write:** One per free user per day (negligible)
- **Cache split:** Public list endpoint stays edge-cacheable; authenticated detail endpoints are per-user
- **Teaser text:** First sentence of analysis gives free users just enough to evaluate upgrade value
- **Scarcity signal:** 1/day creates urgency without feeling punitive

## Alternatives Considered

- **Full auth-wall (no anonymous access):** Rejected — kills SEO and top-of-funnel discovery
- **Rate-limit only (no content gating):** Already implemented but doesn't create upgrade pressure on content value
- **Multiple free ideas/day:** 1/day creates stronger scarcity signal at launch; can always loosen later
- **Random or editor-pick daily free idea:** First-click model is more engaging (user chooses what interests them)

## Security Notes

- Content gating MUST be enforced server-side in Workers — never send full data and hide with CSS/JS
- Stripe subscription status is the source of truth for Pro access
- Daily claim validation must check both user_id and date server-side
