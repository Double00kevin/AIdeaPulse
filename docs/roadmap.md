# AIdeaPulse Roadmap

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
- [x] Pre-filter top 65 signals by engagement (per-source quotas)
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
- [x] Stripe product/price setup + checkout session creation
- [x] Wire Pro CTA button to Stripe Checkout
- [x] Domain + DNS setup (aideapulse.com live, api.aideapulse.com, CORS locked)
- [x] Homepage redesign (dark theme landing page, marketing sections) (2026-03-27)
- [x] Smart Match — personalized idea scoring for Pro users (profile, fitScore, UI) (2026-03-27)
- [ ] Launch (Product Hunt, Reddit, HN)
