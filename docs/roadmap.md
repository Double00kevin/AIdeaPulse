# AIdeaPulse — Roadmap

Check items off as they ship. Log details in `docs/CHANGELOG.md`.

## Sprint 1 — Foundation (done)
- [x] Project scaffold and repo structure
- [x] Product discovery (/office-hours)
- [x] Architecture review (/plan-eng-review)
- [x] Design review (/plan-design-review)
- [x] Pipeline skeleton with scraper/analysis/push stubs
- [x] Git init + initial commit

## Sprint 2 — Core Pipeline + API + Frontend (done)
- [x] Reddit scraper (.json feeds, no API key needed) + domain-specific subreddits
- [x] Hacker News scraper (Firebase API — top stories + Ask/Show HN)
- [x] GitHub Trending scraper (public page, weekly)
- [x] Dev.to scraper (public API, top articles by engagement)
- [x] Lobste.rs scraper (JSON feed, hottest stories)
- [x] NewsAPI scraper (optional key, startup/SaaS/AI queries)
- [x] Google Trends scraper (pytrends, optional enrichment)
- [x] Product Hunt scraper (GraphQL API, date-filtered)
- [x] Pre-filter top signals by engagement (per-source quotas — originally 65, now ~125 with 12 sources)
- [x] Claude API analysis module (JSON parsing, confidence rubric)
- [x] D1 schema + migrations (deployed to Cloudflare)
- [x] Workers API with Hono (ingest webhook HMAC, list, get, health)
- [x] Dedup in Workers (UNIQUE + fuzzy word-set)
- [x] Astro + React islands frontend (idea feed, cards, filters)
- [x] OG image generation per idea (SVG endpoint)
- [x] systemd timer for daily pipeline run
- [x] Test infrastructure (15 pytest tests passing, vitest config)
- [x] Deploy Workers with OG endpoint
- [x] First pipeline run — 660 signals → 60 ideas in production (2026-03-27)

## Sprint 3 — Auth + Polish (done)
- [x] User auth (Clerk — frontend-only + JWT verification in Workers)
- [x] Save/rate ideas (POST/DELETE /api/saved/:ideaId, protected)
- [x] User dashboard page (/dashboard, redirects to sign-in)
- [x] Wire save/rate buttons into IdeaCard UI
- [x] Populate dashboard with saved ideas list
- [x] Email digest infrastructure (Resend integration, preferences UI, dry-run mode)
- [x] Two-stage Claude analysis (Haiku classify → Sonnet analyze)

## Sprint 4 — Monetization + Launch (current)
- [x] About page, Pro upgrade page, favicon, 404
- [x] Stripe webhook handler (checkout, subscription update/delete)
- [x] Rate limiting middleware (free: 50/day, pro: 1000/day)
- [x] Subscription status endpoint + D1 tables
- [x] Stripe product/price setup + checkout session creation (2026-03-27)
- [x] Wire Pro CTA button to Stripe Checkout (2026-03-27)
- [x] Stripe checkout e2e verified — webhook fires, Pro subscription active in D1 (2026-03-28, 9758e8a)
- [x] Google OAuth sign-in working (Clerk production, Testing mode — 2026-03-28)
- [x] Stripe live — sandbox→production keys, live product AIdeaPulse Pro (prod_UEQgecXm2DRu58, $12/mo), webhook endpoint at api.aideapulse.com/api/stripe/webhook (2026-03-28)
- [x] Google OAuth published to production — consent screen exited Testing mode, branding URLs set (2026-03-28)
- [x] Frontend redeployed — privacy + terms pages live on CF Pages (2026-03-28)
- [x] Domain + DNS setup (aideapulse.com → Pages, api.aideapulse.com → Workers, Clerk production CNAMEs)
- [x] Clerk production auth live (prod keys deployed, cross-island fix, SSL certs issued — f767bee, 1cdd9b2)
- [x] Content gating — three-tier visibility: anon/free/pro (ADR-004, 469ec31, 2026-03-27)
- [x] Expand pipeline from 8 to 12 sources — Stack Exchange, GitHub Issues, Discourse Forums, PyPI/npm (2026-03-29, e453238)

## Sprint 5 — Match Ideabrowser Core (done)
- [x] Smart Match: Personalized Idea Matcher (ADR-003) — user profiles, fit scoring, Smart Match toggle (ea50e31, 2026-03-27)
- [x] Rich Narrative Writeups — 3-4 paragraph business cases, product names, validation playbooks, GTM strategies (5edf8d4, 2026-03-30)
- [x] Multi-Dimensional Scoring — opportunity, pain_level, builder_confidence, timing sub-scores (5edf8d4, 2026-03-30)
- [x] Community Signals — raw signal data (Reddit threads, HN posts, etc.) shown alongside ideas (5edf8d4, 2026-03-30)
- [x] Trends Dashboard — /trends page with idea-derived trend data, volume, growth %, Pro-gated time-series (5edf8d4, 2026-03-30)
- [x] Data Export — Pro-only JSON export of all or saved ideas (5edf8d4, 2026-03-30)
- [x] Expanded source_type CHECK — all 12 sources now in D1 schema (5edf8d4, 2026-03-30)
- [x] Deploy Sprint 5 — migrations 0007-0008 applied, Workers deployed, frontend deployed, pipeline run verified with 80 new ideas (2026-03-31)
- [x] GitHub Actions CI/CD — auto-deploy frontend on push to main (88847ac, 2026-03-30)
- [x] Clerk SSR fix — switched to client:only="react", fixed GH Actions env vars (f048f11, 218cd50, c605bf3, 64888d5, 2026-03-30/31)
- [x] Trends fallback — pytrends broken (Google 404), trends dashboard now derives data from ideas table (2026-03-31)

## Sprint 6 — Surpass With AI Tools (next)
- [ ] AI Chat per Idea — conversational AI about any idea (Pro, Haiku)
- [ ] Idea Generator — custom idea generation from user profile (Pro, Sonnet)
- [ ] Validate My Own Idea — user-submitted idea analysis with SWOT (Pro, Sonnet)
- [ ] Framework Analysis — Value Equation, ACP, Value Matrix, Value Ladder per idea (pipeline + Pro)

## Sprint 7 — Growth & Differentiation
- [ ] Idea Builder — landing page copy, tech stack, creative assets, implementation plan (Pro, Sonnet)
- [ ] Market Insights page — cross-source trend analysis, hot categories
- [ ] Success Stories page — founder testimonials
- [ ] Weekly Digest Enhancement — trend analysis + AI Market Pulse

## Launch Milestone
- [ ] Launch (Product Hunt, Reddit, HN) — after all product features are complete and polished

## Backlog
- [ ] API tier (developer access, API key management)
- [ ] Idea comparison tool
- [ ] Custom scraper sources (user-defined subreddits, keywords)
- [ ] Annual pricing option
