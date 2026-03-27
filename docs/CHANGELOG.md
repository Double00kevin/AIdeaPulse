# Changelog

All notable changes to AIdeaPulse will be documented in this file.

## [Unreleased]

### 2026-03-27 — af95782: Homepage redesign (dark theme landing page)
- feat: complete homepage redesign — dark theme (Linear/OrbitAI aesthetic), constellation canvas animation, hero with CTAs, source logo strip (8 platforms), 3-step "How it Works", glassmorphism example idea card, big typography value prop, pricing section ($12/mo Pro with IdeaBrowser comparison), final CTA, 4-column footer
- feat: dark theme applied across all components and pages (explicit Tailwind dark classes — bg-gray-900, text-white/gray hierarchy, cyan-500 accent)
- feat: sticky dark nav with Features/Pricing/About anchor links, pulse logo icon
- feat: Pro page updated — price fixed from $9/mo to $12/mo, IdeaBrowser comparison callout added
- feat: About page rewritten for end users — removed technical implementation details, added founder note
- feat: all components updated for dark theme (IdeaCard, IdeaFeed, SaveButton, Dashboard, HeaderAuth, 404, idea detail)
- feat: ConstellationBg canvas animation (0.77 kB gzipped) for hero background
- feat: BaseLayout supports fullWidth prop for landing page sections

### 2026-03-27 — 1cdd9b2: Clerk production auth + QA fixes
- feat: Clerk production keys wired in (pk_live_, sk_live_ via env vars/Wrangler secrets)
- fix: IdeaFeed and idea detail pages blank due to Clerk dev key failure on production domain
- fix: SaveButton crashes IdeaCard when Clerk context missing (astro-island isolation)
- fix: use global window.Clerk instance for cross-island auth (avoids duplicate ClerkProvider)
- chore: .gstack/ added to gitignore
- deploy: Frontend + Workers redeployed with production Clerk keys
- verify: 60 ideas rendering, Sign in/Sign up working, zero console errors

### 2026-03-27 — 0b1dd3e: Domain + DNS setup, API URL update
- feat: API base URL updated to https://api.aideapulse.com/api
- feat: CORS locked to aideapulse.com, www.aideapulse.com, aideapulse-site.pages.dev
- deploy: Cloudflare Pages project "aideapulse-site" created and deployed
- deploy: Custom domains live — aideapulse.com (frontend), api.aideapulse.com (Workers API)
- verify: 60 ideas in production, health check passing

### 2026-03-27 — bc1a701: Stripe checkout session + Pro CTA button
- feat: POST /api/stripe/checkout creates Stripe Checkout Session (subscription mode)
- feat: ProCheckout React island replaces static CTA — Clerk auth, redirect to Stripe hosted checkout
- feat: Stripe env secrets wired into Workers (STRIPE_SECRET_KEY, STRIPE_PRICE_ID)

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
