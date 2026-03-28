# AIdeaPulse — Open Items & Action Tracker
**Last Updated:** 2026-03-28
**Maintained by:** Kevin

---

## Needs Human Action

| # | Item | Owner | Notes | Due |
|---|------|-------|-------|-----|
| ~~1~~ | ~~Reddit API approval follow-up~~ | ~~Kevin~~ | ~~N/A — using public .json feeds, no API needed (b2084e0)~~ | ~~Closed~~ |
| ~~2~~ | ~~Test full Stripe checkout flow in sandbox~~ | ~~Kevin~~ | ~~Done 2026-03-28 — e2e verified, webhook fires, D1 sub active (9758e8a)~~ | ~~Done~~ |
| ~~5~~ | ~~Delete old Google Client Secret (ending ****ruAM) in GCP~~ | ~~Kevin~~ | ~~Done 2026-03-28 — disabled then deleted in GCP console, only ****QTIz remains~~ | ~~Done~~ |
| 6 | Create privacy policy + terms of service pages | Kevin | Required before Google OAuth verification/publishing to production | Pre-launch |
| 7 | Submit Google OAuth app for verification + publish | Kevin | After privacy/terms pages live, exit Testing mode | Pre-launch |
| ~~3~~ | ~~Set Clerk production keys in CF Pages + Workers~~ | ~~Kevin~~ | ~~Done f767bee — pk_live_ in .env, sk_live_ as Wrangler secret~~ | ~~Done~~ |
| 4 | Stripe sandbox → live key transition | Kevin | After Stripe checkout tested, swap to live keys | Pre-launch |

---

## Decisions Needed

| # | Item | Notes |
|---|------|-------|
| ~~1~~ | ~~Product name / domain~~ | ~~DECIDED: AIdeaPulse — aideapulse.com registered 2026-03-27 (ADR-002)~~ |

---

## Decisions Made

| Item | Decision | Date |
|------|----------|------|
| Auth approach | Clerk (frontend + JWT in Workers) | Sprint 3 |
| Pro tier pricing | $12/mo | Sprint 3 |
| Core user persona | Solo indie hacker with day job | Sprint 1 |
| D1 row limits | 10GB free, fine for year 1 | Sprint 2 |
| R2 usage | Not needed for MVP, raw data stays on KITT | Sprint 2 |
| KITT→CF auth | HMAC-SHA256 with timestamp replay protection | Sprint 2 |

---

## Waiting On

| # | Item | Notes |
|---|------|-------|
| ~~1~~ | ~~Reddit API approval~~ | ~~N/A — using public .json feeds (b2084e0)~~ |
| ~~2~~ | ~~Product Hunt API token~~ | ~~Configured, PH scraper operational since Sprint 2 (b2084e0)~~ |
| ~~3~~ | ~~Clerk email/DKIM DNS verification~~ | ~~5/5 verified 2026-03-27 — SSL certs issuing~~ |

---

## Recently Completed

| Item | Notes |
|------|-------|
| Content gating — three-tier visibility | 469ec31 — daily_free_claims D1 table, server-side tier detection (anon/free/pro), stripped fields for free/anon, first-click daily claim, IdeaDetailGated component, 11 vitest tests. ADR-004. |
| Smart Match — Personalized Idea Matcher | ea50e31 — user_profiles D1 table, profile API, fitScore engine (7 tests), Smart Match toggle in feed, FitBadge on cards. Pro-only. ADR-003. |
| Clerk production auth fully live | DNS 5/5 verified, SSL certs issued, prod keys deployed (f767bee), cross-island auth fix (1cdd9b2) |
| Domain + DNS setup | aideapulse.com → CF Pages, api.aideapulse.com → Workers, 5 Clerk CNAMEs added |
| Clerk production instance | App renamed AIdeaPulse, Frontend API at clerk.aideapulse.com, JWKS live |
| Stripe checkout e2e verified | 9758e8a — test checkout → webhook → D1 sub (plan: pro, status: active). ProCheckout rewritten to use window.Clerk, SSR fix deployed. |
| Stripe checkout flow wired end-to-end | Product created, secrets set, checkout session endpoint + Pro CTA button |
| Sprint 4 pages + Stripe + rate limiting | About, Pro, 404, webhook handler, rate limits |
| Two-stage Claude analysis | Haiku classify → Sonnet analyze |
| Email digest infrastructure | Resend integration, preferences UI |
| Clerk auth + saved ideas | Frontend auth, JWT middleware, save/rate API |
| 8-source pipeline | First run: 660 → 65 → 60 ideas in production |
| Windows docs repo bootstrap | Standard structure created: .claude/, docs/, decisions/ |

---

## Reference

| Document | Purpose |
|----------|---------|
| `docs/CHANGELOG.md` | Timestamped record of every file change |
| `docs/roadmap.md` | Feature roadmap (check off items as they ship) |
| `.claude/CLAUDE.md` | Claude's project context (auto-loaded each session) |
| `decisions/` | Decision log — auto-synced to Obsidian vault |
