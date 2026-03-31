# AIdeaPulse — Project Rules

## Overview

AIdeaPulse is an AI-powered startup idea discovery SaaS platform. It scrapes demand signals from 12 sources (Reddit, Hacker News, Product Hunt, GitHub Trending, Dev.to, Lobste.rs, NewsAPI, Google Trends, Stack Exchange, GitHub Issues, Discourse Forums, PyPI/npm), analyzes them via Claude API, and serves structured idea briefs through a web app with free/pro/API monetization tiers.

- **Last updated:** 2026-03-31 (64888d5)
- **Status:** Sprint 5 complete — Rich narratives, multi-dimensional scores, community signals, trends dashboard, data export all deployed and verified. 201 ideas in production with full Sprint 5 fields. GitHub Actions CI/CD for frontend. Sprint 6 (AI Chat, Idea Generator, Validate My Idea, Framework Analysis) planned. Launch posts still pending.

## Architecture

| Component          | Technology                        | Where      |
|--------------------|-----------------------------------|------------|
| Ingestion pipeline | Python 3.12 + httpx + pytrends   | KITT       |
| AI analysis        | Claude API (Anthropic SDK)        | KITT       |
| API/backend        | Cloudflare Workers (TypeScript)   | Cloudflare |
| Database           | Cloudflare D1 (SQLite)            | Cloudflare |
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
