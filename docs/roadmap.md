# IdeaVault Roadmap

## Sprint 1 — Foundation (done)
- [x] Project scaffold and repo structure
- [x] Product discovery (/office-hours)
- [x] Architecture review (/plan-eng-review)
- [x] Design review (/plan-design-review)
- [x] Pipeline skeleton with scraper/analysis/push stubs
- [x] Git init + initial commit

## Sprint 2 — Core Pipeline + API + Frontend (current)
- [x] Reddit scraper (PRAW) + domain-specific subreddits
- [x] Google Trends scraper (pytrends, optional enrichment)
- [x] Product Hunt scraper (GraphQL API, date-filtered)
- [x] Pre-filter top 30 signals by engagement
- [x] Claude API analysis module (JSON parsing, confidence rubric)
- [x] D1 schema + migrations (deployed to Cloudflare)
- [x] Workers API with Hono (ingest webhook HMAC, list, get, health)
- [x] Dedup in Workers (UNIQUE + fuzzy word-set)
- [x] Astro + React islands frontend (idea feed, cards, filters)
- [x] OG image generation per idea (SVG endpoint)
- [x] systemd timer for daily pipeline run
- [x] Test infrastructure (15 pytest tests passing, vitest config)
- [x] Deploy Workers with OG endpoint
- [ ] First pipeline run (waiting on Reddit API + Anthropic key)

## Sprint 3 — Auth + Polish
- [ ] User auth (Clerk recommended)
- [ ] Save/rate ideas
- [ ] User dashboard
- [ ] Email digest (Pro tier)
- [ ] Two-stage Claude analysis (classify then analyze)

## Sprint 4 — Monetization + Launch
- [ ] Stripe integration (free/pro tiers)
- [ ] Rate limiting per tier
- [ ] About page, Pro upgrade page, favicon, 404
- [ ] Domain + DNS setup
- [ ] Launch (Product Hunt, Reddit, HN)
