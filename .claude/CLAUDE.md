# IdeaVault — Project Rules

## Overview

IdeaVault is an AI-powered startup idea discovery SaaS platform. It scrapes demand signals from 8 sources (Reddit, Hacker News, Product Hunt, GitHub Trending, Dev.to, Lobste.rs, NewsAPI, Google Trends), analyzes them via Claude API, and serves structured idea briefs through a web app with free/pro/API monetization tiers.

- **Last updated:** 2026-03-27
- **Status:** Sprint 3 — Auth + Polish (Clerk auth deployed, save/rate API live)

## Architecture

| Component          | Technology                        | Where      |
|--------------------|-----------------------------------|------------|
| Ingestion pipeline | Python 3.12 + httpx + pytrends   | KITT       |
| AI analysis        | Claude API (Anthropic SDK)        | KITT       |
| API/backend        | Cloudflare Workers (TypeScript)   | Cloudflare |
| Database           | Cloudflare D1 (SQLite)            | Cloudflare |
| Frontend           | Astro + React islands + Tailwind  | CF Pages   |
| Object storage     | Cloudflare R2                     | Cloudflare |
| Auth               | JWT (custom) or Clerk             | CF Workers |
| Payments           | Stripe                            | CF Workers |
| Scheduling         | systemd timer                     | KITT       |

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

## Close The Loop Protocol

When asked to "close the loop":
1. `git log -1 --oneline` to get latest commit.
2. Update "Last updated" date in this file.
3. Append summary to `docs/CHANGELOG.md` with commit hash.
4. Verify matching roadmap item is checked off in `docs/roadmap.md`.
5. Verify `README.md` reflects current capabilities — update if stale.
6. Check all other docs for staleness against what just shipped.
7. Stage, commit (`docs: close the loop for [hash]`), and push.
