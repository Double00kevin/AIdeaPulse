# AIdeaPulse — Project Rules

## Overview

AIdeaPulse is an AI-powered startup idea discovery SaaS platform. It scrapes demand signals from 12 sources (Reddit, Hacker News, Product Hunt, GitHub Trending, Dev.to, Lobste.rs, NewsAPI, Google Trends, Stack Exchange, GitHub Issues, Discourse Forums, PyPI/npm), analyzes them via Claude API, and serves structured idea briefs through a web app with free/pro/API monetization tiers.

- **Last updated:** 2026-03-31 (bd2e1f8)
- **Status:** Sprint 6 complete — AI Actions (5 structured deep dives per idea via Haiku), Idea Generator (personalized ideas from Smart Match profile via Sonnet), Validate My Idea (user-submitted SWOT with FTS5 signal cross-referencing via Sonnet), Framework Analysis (4 plain-language framework scores per idea via pipeline). Durable Object rate limiting. @anthropic-ai/sdk on Workers. 201 ideas in production. Pricing adjustment ($12→$20-25/mo) planned before launch. Launch posts still pending.

## Architecture

| Component          | Technology                        | Where      |
|--------------------|-----------------------------------|------------|
| Ingestion pipeline | Python 3.12 + httpx + pytrends   | KITT       |
| AI analysis        | Claude API (Anthropic SDK)        | KITT       |
| Real-time AI       | @anthropic-ai/sdk (Sonnet + Haiku) | CF Workers |
| API/backend        | Cloudflare Workers (TypeScript)   | Cloudflare |
| Database           | Cloudflare D1 (SQLite + FTS5)     | Cloudflare |
| Rate limiting      | Durable Objects (atomic counters) | Cloudflare |
| Frontend           | Astro + React islands + Tailwind  | CF Pages   |
| Object storage     | Cloudflare R2                     | Cloudflare |
| Auth               | Clerk (prod keys, global window.Clerk) | CF Workers |
| Payments           | Stripe                            | CF Workers |
| Scheduling         | systemd timer (23:00 Central daily, DST-aware) | KITT |

## Security (non-negotiable)

- No secrets in repo — all API keys via env vars
- KITT->CF ingest webhook uses HMAC-SHA256 signature (timing-safe compare, 5-min timestamp window)
- Password hashing with argon2 (or bcrypt on Workers, Clerk recommended for MVP)
- JWT with short expiry + refresh tokens
- Input validation on all API endpoints
- Rate limiting at Cloudflare edge

## Code Conventions

### Python (pipeline/)
- Python 3.12+, type hints everywhere, docstrings on public functions
- Linting: ruff
- Config via env vars (python-dotenv for local dev, never committed)

### TypeScript (workers/, frontend/)
- Strict mode, eslint
- Wrangler for Workers dev/deploy

### Git
- Conventional commits: feat:, fix:, chore:, docs:
- Every change logged in docs/CHANGELOG.md
- Security changes noted separately
- Significant architecture decisions logged in docs/decisions/ as ADRs

## Close The Loop Protocol

When asked to "close the loop":
1. `git log -1 --oneline` to get latest commit.
2. Update "Last updated" date in this file.
3. Append summary to `docs/CHANGELOG.md` with commit hash.
4. Verify matching roadmap item is checked off in `docs/roadmap.md`.
5. Verify `README.md` reflects current capabilities — update if stale.
6. Check all other docs for staleness against what just shipped.
7. Stage, commit (`docs: close the loop for [hash]`), and push.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
