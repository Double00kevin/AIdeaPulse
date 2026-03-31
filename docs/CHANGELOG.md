# Changelog

All notable changes to AIdeaPulse (formerly IdeaVault) will be documented in this file.

## [Unreleased]

### 2026-03-31 — bd2e1f8: Sprint 6 Phase 6B — AI Actions + Idea Generator

**Workers (API):**
- feat: `POST /api/ideas/:id/actions` — 5 structured AI deep-dive actions per idea: market opportunity, technical feasibility, revenue model, weekend build plan, competitor landscape. Haiku model for fast/cheap responses. 24h D1 cache (skip API call if cached response exists). Rate-limited via Durable Object (free: 1/day, Pro: 30/day)
- feat: `POST /api/generate` — personalized idea generation from Smart Match profile. Loads user's skills/budget/niches/experience, top 50 ideas as dedup context (slim: title + one_liner + scores). Sonnet model. Returns 3 ideas with FIT scores. Rate-limited (free: see 1 idea + blur rest, Pro: 5/day)
- feat: `actionsHandler` and `generateHandler` route modules with auth, tier check, rate limiting, Anthropic SDK calls, error handling (429→503, 500→502, timeout→retry)

**Frontend:**
- feat: `AIActions.tsx` — Deep Dive section on idea detail with 5 action buttons (grid layout), inline result panel, loading spinners, Pro-gating on 3 actions, cached response indicator
- feat: `IdeaGenerator.tsx` — /generate page component with profile summary (skill/niche chips), generate button with loading UX, 3 idea result cards with FIT score badges, free tier blur + upgrade CTA, remaining count display
- feat: `generate.astro` — new /generate page
- feat: `IdeaCard.tsx` — wired AIActions component into expanded detail (after Framework Analysis)
- feat: nav updated with "Generate" link

**D1:**
- feat: migration 0011 — `idea_actions` cache table (idea_id, action_type, response_json, created_at, expires_at) with composite index
- feat: migration 0012 — `generated_ideas` table (user_id, ideas_json, created_at) with user index

### 2026-03-31 — 1315bd3: Sprint 6 Phase 6A — Framework Analysis + Validate My Idea

**Pipeline:**
- feat: `analyze_frameworks()` — new 3rd-stage Sonnet analysis producing 4 plain-language framework scores per idea: "Is this worth building?" (Value Equation), "Who would pay and why?" (ACP), "How does this stack up?" (Value Matrix), "Where's the money?" (Value Ladder). Each framework has label, framework name, score (0-10), and 2-3 sentence explanation
- feat: `FRAMEWORKS_PROMPT` — separate focused prompt for framework analysis (keeps existing ANALYSIS_PROMPT unchanged, avoids prompt bloat)
- feat: frameworks stage wired into `_analyze_batch()` after stage 2 — only runs on ideas that pass confidence threshold

**Workers (API):**
- feat: `POST /api/validate` — "Validate My Own Idea" endpoint. User submits idea text (max 500 chars, HTML-stripped, unicode-normalized). FTS5 full-text search finds top 20 related ideas from D1. Sonnet produces SWOT analysis cross-referenced against signal database. Returns confidence score, strengths/weaknesses/opportunities/threats, matched signals, "build this weekend" next step. Rate-limited via Durable Object (free: 1/calendar month, Pro: 10/day). Content gating: free sees confidence + strengths only
- feat: `RateLimiterDO` — Durable Object for atomic per-feature rate limiting. SQLite-backed (free plan compatible). Supports daily and monthly windows. Fail-open on DO unavailability (allow + log). Replaces global rate limiter
- feat: `ai-helpers.ts` — shared utilities: `createAnthropicClient()`, `sanitizeUserInput()` (HTML strip, unicode normalize, newline collapse, length limit), `parseAIJsonResponse()` (markdown fence stripping), `getRateLimitKey()` (daily/monthly key generation)
- feat: `ideas.ts` — `frameworks_json` now parsed as array (was object), `teaserIdeaFields()` includes first framework header + score for free user teaser
- feat: `ingest.ts` — frameworks type updated to accept array format from pipeline

**Frontend:**
- feat: `FrameworkAnalysis.tsx` — collapsible "Quick Scores" section on idea detail. Pro: all 4 frameworks with expandable explanations. Free: 1st score visible, rest blurred with upgrade CTA. Color-coded scores (green 8+, amber 5-7, gray <5)
- feat: `ValidateForm.tsx` — /validate page component. Textarea with 500-char limit, character counter, "Validate This Idea" button with loading spinner + disabled state during request. Auth via window.Clerk. Error handling for rate limits, network errors, auth failures
- feat: `ValidationResult.tsx` — SWOT grid display with confidence score circle (color-coded), 4 quadrant boxes (Strengths/Weaknesses/Opportunities/Threats), matched signal count, "Build This Weekend" next step (Pro), free tier shows Strengths only + blur + upgrade CTA
- feat: `validate.astro` — new /validate page
- feat: `IdeaCard.tsx` — wired FrameworkAnalysis component into expanded detail, added frameworks + frameworks_teaser to Idea interface
- feat: nav updated with "Validate" link

**D1:**
- feat: migration 0009 — FTS5 virtual table `ideas_fts` for idea similarity matching (title + narrative_writeup), populated from existing 201 ideas, with INSERT/UPDATE/DELETE sync triggers
- feat: migration 0010 — `validations` table (user_id, idea_text, result_json, created_at) with user index

**Config:**
- feat: `wrangler.jsonc` — Durable Object binding (RATE_LIMITER, RateLimiterDO), new_sqlite_classes migration tag
- feat: `ANTHROPIC_API_KEY` set as Wrangler secret for real-time AI endpoints
- feat: `@anthropic-ai/sdk` added to Workers dependencies (typed client, automatic retries)
- chore: CLAUDE.md — added gstack skill routing rules
- chore: roadmap — moved Launch to dedicated milestone, Sprint 4 marked done

### 2026-03-31 — 64888d5: Trends dashboard fix + CI env var

- fix: trends route path mismatch — POST endpoint was `/api/trends/ingest/trends` (404), fixed to `/api/trends/ingest` by changing handler route from `/ingest/trends` to `/ingest` and updating pipeline URL derivation
- fix: pytrends returning 0 signals (Google 404 on trending endpoint) — added fallback in GET `/api/trends` that derives trend data from ideas table: source categories by volume + top product names by confidence/timing scores
- fix: added `PUBLIC_API_URL` env var to GitHub Actions CI build step — frontend API calls were hitting relative `/api` instead of `api.aideapulse.com` in Pages deployment

### 2026-03-31 — c605bf3: Clerk double-provider crash + export auth fix

- fix: Clerk ClerkProvider was double-mounting on pages with multiple React islands — HeaderAuth now wraps ClerkProvider internally, other components use `window.Clerk` global
- fix: export button in IdeaFeed was using `window.location.href` redirect (no auth header) — rewrote to fetch with Bearer token, create blob, trigger download via anchor click

### 2026-03-31 — 218cd50: Clerk publishable key in CI

- fix: `PUBLIC_CLERK_PUBLISHABLE_KEY` was missing from GitHub Actions build — Clerk never loaded in Pages-deployed frontend (auth buttons invisible, dashboard blank)
- Added secret to GH Actions workflow env block

### 2026-03-30 — f048f11: Clerk SSR crash + Discourse tag fix

- fix: `HeaderAuth` used `client:load` which attempted SSR in Workers runtime, silently crashing and truncating all page HTML — switched to `client:only="react"` to skip SSR entirely
- fix: Discourse scraper returned tags as dicts (not strings) — pipeline crashed on `join()`. Now extracts tag name from dict objects.

### 2026-03-30 — 10ead57, 88847ac: GitHub Actions CI/CD

- chore: added GitHub Actions workflow for auto-deploying frontend to Cloudflare Pages on push to `main` (paths: `frontend/**`)
- chore: added `workflow_dispatch` trigger for manual frontend deploys

### 2026-03-30 — 5edf8d4: Sprint 5 — Match Ideabrowser Core

**Pipeline:**
- feat: `IdeaBrief` dataclass expanded with 5 new fields: `narrative_writeup`, `product_name`, `validation_playbook`, `gtm_strategy`, `scores` (dict with opportunity/pain_level/builder_confidence/timing), `community_signals` (list of signal dicts), `frameworks` (dict, Sprint 6 placeholder)
- feat: `ANALYSIS_PROMPT` rewritten — now requests product name, 3-4 paragraph business case, validation playbook, GTM strategy, and 4-dimension scores. `max_tokens` increased from 1500 to 3000.
- feat: `confidence_score` now computed as weighted composite: opportunity×0.30 + pain_level×0.25 + builder_confidence×0.25 + timing×0.20
- feat: all 12 signal formatters updated to return structured community signal dicts (source, title, URL, engagement metrics, excerpt) alongside text
- feat: `push_trends()` function added to push Google Trends data to `/api/trends/ingest`

**Workers (D1 + API):**
- feat: migration 0007 — ideas table recreation with 7 new columns (narrative_writeup, product_name, validation_playbook, gtm_strategy, scores_json, community_signals_json, frameworks_json) + expanded source_type CHECK for all 12 sources
- feat: migration 0008 — `keyword_trends` table (keyword, source, volume, growth_pct, related_topics_json, time_series_json, snapshot_date)
- feat: `ingest.ts` — IdeaPayload extended with 7 new fields, INSERT statement expanded to 22 bind params
- feat: `ideas.ts` — IdeaRow extended, `formatIdea()` parses new JSON columns, `teaserIdeaFields()` now includes product_name + signal_count
- feat: `trends.ts` (NEW) — POST `/api/trends/ingest` (HMAC-authenticated pipeline push), GET `/api/trends` (list keywords with volume/growth), GET `/api/trends/:keyword` (detail with time-series, Pro-gated)
- feat: `export.ts` (NEW) — GET `/api/export/ideas` (Pro-only JSON export with rate limiting: 10/day, scope=all|saved, Content-Disposition download header)

**Frontend:**
- feat: `ScoreBreakdown.tsx` (NEW) — 4 horizontal bar charts for opportunity/pain/builder/timing scores, color-coded (green >=80, amber >=50, gray <50)
- feat: `CommunitySignals.tsx` (NEW) — source signal cards with engagement metrics, source-specific accent colors, linked titles, excerpts
- feat: `TrendChart.tsx` (NEW) — pure SVG line chart (no dependencies), dark theme grid, cyan data line with area fill
- feat: `TrendsDashboard.tsx` (NEW) — keyword grid with volume + growth %, search bar, click-to-detail panel, Pro-gated time-series
- feat: `trends.astro` (NEW) — `/trends` page with TrendsDashboard component
- feat: `IdeaCard.tsx` — product name badge in headline, expanded view now shows Business Case (narrative paragraphs), Validation Playbook (step list), GTM Strategy, Score Breakdown, Community Signals
- feat: `IdeaFeed.tsx` — Idea interface extended with Sprint 5 fields, Export button (Pro-only) in filter bar
- feat: `BaseLayout.astro` — "Trends" link added to navigation

**Content gating (Sprint 5):**
- Free: composite confidence score, product name (teaser), signal count
- Pro: sub-score breakdown, full narrative, validation playbook, GTM strategy, community signal details, time-series charts, JSON export

### 2026-03-30 — a5b3547: Non-interactive Pages deploy

- chore: added `wrangler.toml` for non-interactive Cloudflare Pages deploys

### 2026-03-29 — e453238: Expand pipeline from 8 to 12 sources
- feat: 4 new demand signal scrapers — Stack Exchange (REST API, 5 SE sites), GitHub Issues (search API, feature requests by reaction count), Discourse Forums (6 public instances: OpenAI, Fly.io, Netlify, Discourse Meta, Grafana, Elastic), PyPI/npm package trends (RSS + pypistats + npm registry)
- New prefilter functions: top 15 per source by engagement (SE score w/ unanswered boost, GH reactions, Discourse likes+replies, package downloads)
- Pipeline now produces ~726 additional raw signals per run, filtered to ~60 for Claude analysis
- Zero new dependencies or env vars required — all free APIs

### 2026-03-28 — d86b79b: Landing page redesign
- feat: redesigned landing page with animated ECG heartbeat pulse dividers (new EcgDivider.tsx React island)
- Full-page constellation background (fixed position, visible behind all sections)
- Hero section simplified — removed Live Feed Preview mockup, updated trust line to "1 free idea daily"
- Source strip simplified — removed 8 individual SVG logos, bold "SCANNING ALL SOURCES EVERY DAY" label
- New unified "Today's Idea" section: free idea card with badge, card legend (6-item grid), 10 locked title rows (first 4 visible, rest blurred), upgrade CTA box
- How It Works updated: Scrape→"Multi-Agent Research", Deliver→"Discover", updated descriptions
- Removed "Stop guessing what to build" value proposition section
- Pricing tiers updated: Free = 1 idea/day + view titles (rest disabled), Pro = all features bold
- Competitor callout updated: "Others charge $299–$999/year..."
- Footer legal links now point to /terms and /privacy
- 5 ECG dividers placed between sections (none between hero and source strip)
- Section spacing normalized (py-10 sections, my-10 dividers, transparent backgrounds)

### 2026-03-28 — c14425d: Pre-launch gates completed
- **Stripe live:** sandbox keys replaced with production keys across all three Wrangler secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID). Live product: AIdeaPulse Pro (prod_UEQgecXm2DRu58), price: $12/mo (price_1TFxq1P3Smm2ZjICslGZI1Q7). Webhook endpoint at api.aideapulse.com/api/stripe/webhook listening for checkout.session.completed, customer.subscription.updated, customer.subscription.deleted.
- **Google OAuth published:** GCP OAuth consent screen exited Testing mode → In production. Branding page updated with home page, privacy policy (/privacy), and terms of service (/terms) URLs. No logo uploaded yet — users see "unverified app" warning until logo + verification submitted (cosmetic, not blocking).
- **Frontend redeployed:** privacy.astro and terms.astro (committed in cc4d8a8) now live on Cloudflare Pages.

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
