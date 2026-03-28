# Changelog

All notable changes to AIdeaPulse (formerly IdeaVault) will be documented in this file.

## [Unreleased]

### 2026-03-28 — 66da867: Apply D1 migrations in vitest test setup
- fix: integration tests in workers/test/health.test.ts failed because miniflare D1 had no tables
- added workers/test/setup.ts — applies full D1 schema via env.DB.batch() before tests run
- wired setup file into vitest.config.ts via setupFiles
- all 23 Workers tests now pass (7 fitScore + 11 ideas routes + 5 health/integration)

### 2026-03-28 — cc4d8a8: Privacy policy and terms of service pages
- feat: /privacy page — full privacy policy with all sections, CCPA/GDPR subsections, styled to match site
- feat: /terms page — full terms of service with 18 sections
- feat: BaseLayout footer updated with Privacy Policy and Terms of Service links
- feat: cross-links at bottom of each page pointing to the other
- build verified clean, both pages in output

### 2026-03-28 — 19a4db4: Deploy fixes + quick fixes batch
- deploy: Workers redeployed to production — content gating verified live (anon response strips pro fields, returns `tier: "anon"`)
- fix: pipeline webhook URL updated from workers.dev to api.aideapulse.com in pipeline/.env
- ops: systemd timer rescheduled to 23:00 Central (DST-aware via TimezoneOfTimer), service timeout increased to 18000s (5 hours)
- fix: vitest config updated to reference wrangler.jsonc instead of wrangler.toml (f0dc104)
- fix: removed localhost:8787 fallback in ideas/[id].astro — now uses /api like all other components (6285df9)
- fix: added nodejs_compat compatibility flag to wrangler.jsonc — vitest now initializes and runs (18 unit tests passing) (19a4db4)
- verified: /api/profile returns 401 for unauthenticated requests (was 404 pre-deploy)
- docs: deploy verification and quick-fix results logged to docs/testing-results/

### 2026-03-28 — 9758e8a: Stripe checkout flow verified end-to-end
- fix: Google OAuth Client Secret mismatch fixed (rotated secret in GCP, updated in Clerk SSO)
- fix: attempted @clerk/astro integration (f25b84d) — broke SSR on Cloudflare Workers, reverted (bb0bd7b, 1bd1bb1)
- fix: module-level `let clerkMounted` singleton guard broke Vite SSR bundling — reverted to original AuthProvider
- fix: ProCheckout rewritten to use `window.Clerk` global instead of own ClerkProvider — eliminates duplicate ClerkProvider error on multi-island pages (9758e8a)
- verified: Stripe test checkout flow works — click "Upgrade to Pro" → Stripe checkout → webhook fires → D1 subscriptions table updated (plan: pro, status: active)
- verified: Google OAuth sign-in working via Clerk (Testing mode, test user configured)
- note: Google OAuth app still in Testing mode — needs privacy policy + terms pages before verification/publishing
- chore: old Google Client Secret (ending ****ruAM) disabled + deleted from GCP — only ****QTIz remains (active in Clerk)

### 2026-03-27 — 469ec31: Content gating — three-tier visibility (ADR-004)
- feat: D1 migration 0006 — daily_free_claims table (user_id + claimed_date PK, idea_id, index)
- feat: server-side tier detection (anon/free/pro) via optionalAuth middleware on ideas endpoints
- feat: stripIdeaFields() — anon/free list view returns only id, title, source_type, confidence_score, created_at, build_complexity
- feat: teaserIdeaFields() — gated detail view adds one_liner for teaser
- feat: GET /api/ideas returns `tier` field + `daily_free_idea_id` for free users; Pro gets full data, free gets stripped (except daily claim), anon gets stripped
- feat: GET /api/ideas/:id — Pro full access, free first-click daily claim (auto-insert), anon teaser + signup_required
- feat: daily claim boundary at 06:00 UTC (aligned with pipeline run)
- feat: IdeaFeed always sends Authorization header, reads tier/daily_free_idea_id from response
- feat: IdeaCard three render modes — anon (title + sign-up CTA), free gated (title + score + claim/upgrade CTA with lock icon), full (unchanged)
- feat: IdeaDetailGated component — client-side re-fetch with auth for detail pages, teaser + CTA fallback
- feat: ideas/[id].astro SSR renders anon teaser for SEO/social sharing, hydrates with auth client-side
- feat: 11 vitest unit tests — stripIdeaFields, teaserIdeaFields, getClaimDate (06:00 UTC boundary, month/year edges)
- fix: stripIdeaFields corrected to return source_type + build_complexity (469ec31)
- deploy: D1 migration 0006 applied, Workers redeployed

### 2026-03-27 — ea50e31: Smart Match shipped
- feat: Smart Match — personalized idea scoring for Pro users
- D1 migration 0005: user_profiles table (skills_json, budget_range, niches_json, experience_level)
- POST/GET /api/profile endpoints with Zod validation + Pro subscription gate
- fitScore scoring engine: weighted skill/niche/budget/complexity match (workers/src/scoring/fitScore.ts)
- 7 vitest unit tests for fitScore (all passing)
- GET /api/ideas?smart_match=true — scores + re-ranks by fit_score for Pro users
- ProfileSetup.tsx modal: chip selectors for skills/niches, radio groups for budget/experience
- IdeaFeed.tsx: Smart Match toggle (Pro only), opens ProfileSetup if no profile set
- IdeaCard.tsx: FIT badge in scan row (green 80+, amber 50-79, gray <50, tooltip shows fit_reason)
- verifyClerkToken exported for direct use in route code
- Spec: decisions/003-smart-match-personalized-idea-matcher.md + docs/specs/ on KITT

### 2026-03-27 — ADR-003: Smart Match spec complete (planning phase)
- docs: Created ADR-003 — Personalized Idea Matcher (Smart Match) full spec with 7 Claude Code prompts
- Features 2-5 backlog summarized: Execution Kit, Deep Validation, Content Engine, Niche Packs
- Roadmap updated with Sprint 5 section

### 2026-03-27 — 389324a: Close the loop (docs sync)
- docs: KITT-side close the loop for 1cdd9b2 (Claude Code)
- docs: Cowork-side close the loop — CHANGELOG, roadmap, OPEN_ITEMS all synced

### 2026-03-27 — Domain + DNS + Clerk Production Setup
- feat: custom domain aideapulse.com pointed to CF Pages (aideapulse-site)
- feat: custom domain api.aideapulse.com routed to Workers (aideapulse-api)
- feat: API base URL updated to https://api.aideapulse.com, CORS locked to aideapulse.com
- feat: Clerk production instance created (clerk.aideapulse.com, accounts.aideapulse.com)
- feat: Clerk email/DKIM CNAMEs added (clkmail, clk._domainkey, clk2._domainkey)
- feat: Clerk app renamed from IdeaVault to AIdeaPulse
- fix: removed Clerk dependency from homepage IdeaFeed for production compatibility (e97295d)
- fix: stubbed SaveButton to avoid useAuth() crash with dev keys (a713995)
- chore: OPEN_ITEMS.md cleaned up (removed stale git init + Anthropic key items)

### 2026-03-27 — Clerk Production Auth Live (f767bee, 1cdd9b2)
- feat: Clerk production keys deployed — pk_live_ in .env, sk_live_ as Wrangler secret (f767bee)
- fix: cross-island auth — replaced dual ClerkProvider with window.Clerk global for IdeaFeed + SaveButton (1cdd9b2)
- fix: 3 Clerk DKIM CNAME typos corrected (001n8d → 001m8d) — all 5/5 DNS verified, SSL certs issued
- result: full site live at aideapulse.com — 60 ideas, Sign in/Sign up, zero console errors

### 2026-03-27 — Rename IdeaVault → AIdeaPulse
- chore: registered aideapulse.com on Cloudflare Registrar
- chore: renamed project from IdeaVault to AIdeaPulse across all docs
- chore: ADR-002 logged (decisions/002-rename-ideavault-to-aideapulse.md)
- chore: Stripe sandbox secrets set (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID)
- feat: Stripe checkout session endpoint + Pro CTA wired (via Claude Code on KITT)

### 2026-03-27 — 5637c8b: Sprint 4 — pages, favicon, Stripe, rate limiting
- feat: About page (/about), Pro pricing page (/pro), 404 page
- feat: SVG favicon (blue rounded square with "IV")
- feat: Nav updated with About + Pro links
- feat: Stripe webhook handler with signature verification
- feat: Rate limiting middleware (free 50/day, pro 1000/day)
- feat: GET /api/subscription endpoint
- feat: D1 subscriptions + rate_limits tables
- deploy: Workers redeployed with Stripe + rate limit routes

### 2026-03-27 — 6808e54: Two-stage analysis + email digest
- feat: Haiku classifier (stage 1) filters noise before Sonnet analysis (stage 2)
- feat: Email digest route (preferences + send endpoint with Resend)
- feat: D1 email_preferences table (user_id, email, frequency)
- feat: Dashboard digest preferences UI (email, frequency toggle)
- deploy: Workers redeployed with digest route

### 2026-03-27 — afdeea8: Save/rate buttons, populated dashboard
- feat: SaveButton component (toggle save, 1-5 star rating, Clerk auth tokens)
- feat: IdeaFeed fetches user's saved ideas on sign-in, passes state to cards
- feat: Dashboard shows saved ideas with ratings, confidence, remove button

### 2026-03-27 — 6463065: Clerk auth, JWT middleware, saved ideas API
- feat: @clerk/clerk-react with ClerkProvider, HeaderAuth (sign in/up modals + avatar)
- feat: protected Dashboard page (/dashboard) with redirect-to-sign-in
- feat: RS256 JWT verification middleware for Workers (Clerk JWKS, 1hr cache)
- feat: requireAuth/optionalAuth middleware helpers
- feat: GET/POST/DELETE /api/saved — save, rate, and unsave ideas (protected)
- feat: D1 saved_ideas table (user_id, idea_id, rating 1-5) with indexes
- chore: CORS updated with Authorization header + DELETE method

### 2026-03-27 — a75e97b: Expand pipeline to 8 data sources, first successful run
- feat: 5 new scrapers — Hacker News (Firebase API), GitHub Trending, Dev.to, Lobste.rs, NewsAPI
- feat: Reddit scraper rewritten to use public .json feeds (no API key required, removed PRAW dep)
- feat: prefilter quotas for all 8 sources (HN: top 15 w/ Ask/Show boost, GitHub: top 10, etc.)
- feat: D1 migration expanding source_type CHECK constraint for new sources
- feat: Workers source filter updated for 8 source types
- feat: frontend source dropdown includes all 8 sources
- feat: first end-to-end pipeline run — 660 raw signals → 65 filtered → 60 ideas in production D1
- deploy: Workers redeployed, D1 migration applied

### 2026-03-27 — ba14cb1: OG images, tests, docs cleanup
- feat: OG image endpoint (GET /api/og/:id) — branded SVG per idea for social sharing
- feat: 15 pytest tests for pipeline (prefilter, analysis, push signature)
- feat: vitest + miniflare config for Workers API tests
- docs: cleaned up OPEN_ITEMS.md, checked off roadmap items
- deploy: redeployed Workers API with OG endpoint

### 2026-03-26 — Sprint 2: Core Pipeline + API + Frontend
- feat: complete Reddit scraper with domain-specific subreddits (r/webdev, r/freelance, etc.)
- feat: Product Hunt scraper with date filtering (last 7 days)
- feat: Google Trends scraper (optional enrichment, graceful failure)
- feat: pre-filter module (top 20 Reddit, top 5 PH, all Trends)
- feat: Claude API analysis with JSON parsing, confidence rubric, error handling
- feat: push module with HMAC-only auth, retry 3x + spool to disk
- fix: removed Bearer token leak from webhook auth headers
- fix: added X-Webhook-Timestamp header for replay protection
- feat: D1 schema with JSON columns, normalized title for dedup, indexes
- feat: Hono Workers API (ingest webhook, ideas list/detail, health check)
- feat: fuzzy dedup in Workers (word-set Jaccard similarity >0.85)
- feat: cursor-based pagination with complexity/source/sort filters
- feat: Astro + React islands frontend with Tailwind
- feat: data-forward idea cards (complexity dot, confidence score, expand/collapse)
- feat: filter bar, loading/empty/error states, responsive layout, a11y
- feat: individual idea pages (/ideas/:id) with SEO meta tags
- feat: systemd timer for daily 6am UTC pipeline run
- docs: updated CLAUDE.md, roadmap, architecture for Astro + eng review decisions

### 2026-03-26 — Sprint 1: Foundation
- chore: initial project scaffold — repo structure, CLAUDE.md, pipeline stubs, docs

### 2026-03-27 — Windows-side docs repo bootstrap
- CREATED docs-side repo structure: .claude/, docs/, decisions/
- CREATED .claude/CLAUDE.md with full architecture context + Close The Loop protocol
- CREATED docs/CHANGELOG.md (mirrored from KITT)
- CREATED docs/OPEN_ITEMS.md, docs/roadmap.md
- CREATED decisions/001-architecture-split-infra.md (mirrored from KITT)
- CREATED README.md, .gitignore
