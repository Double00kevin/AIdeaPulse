# AIdeaPulse

AI-powered startup idea discovery platform. Scrapes demand signals from 12 sources (Reddit, Hacker News, Product Hunt, GitHub Trending, Dev.to, Lobste.rs, NewsAPI, Google Trends, Stack Exchange, GitHub Issues, Discourse Forums, PyPI/npm), runs them through Claude API for structured analysis, and serves idea briefs through a web app.

## Status

Sprint 6 complete (Surpass With AI Tools) — 4 new AI-powered features deployed. 201+ ideas in production. GitHub Actions CI/CD. Pricing adjustment and launch planned.

**Live:** https://aideapulse.com | API: https://api.aideapulse.com | Validate: https://aideapulse.com/validate | Generate: https://aideapulse.com/generate | Trends: https://aideapulse.com/trends

**What's built:** 12-source pipeline → Claude three-stage analysis (classify → analyze → frameworks) → D1 storage with FTS5 full-text search → dark-theme Astro frontend. Clerk auth, Stripe Pro subscriptions, Durable Object per-feature rate limiting. AI Actions (5 deep dives per idea via Haiku), Idea Generator (personalized ideas from Smart Match profile via Sonnet), Validate My Idea (user-submitted SWOT with signal cross-referencing via Sonnet), Framework Analysis (4 scored business frameworks per idea). Smart Match, rich narratives, community signals, trends dashboard, data export, OG images.

## Architecture

```
KITT (Python 3.12)                              Cloudflare
┌───────────────────────────┐                  ┌──────────────────────────┐
│  systemd timer (23:00 CT) │                  │  Hono Worker             │
│         │                 │                  │    ├─ POST /api/ingest   │
│         ▼                 │                  │    ├─ POST /api/validate │
│  12 Scrapers              │  HMAC-SHA256     │    ├─ POST /api/generate │
│  ├─ Reddit, HN, PH …    │  ──────────────► │    ├─ POST /:id/actions  │
│  ├─ SE, GH Issues …      │                  │    ├─ GET /api/ideas     │
│  └─ Discourse, PyPI/npm  │                  │    ├─ GET /api/trends    │
│         │                 │                  │    └─ GET /api/health    │
│  Pre-filter (top ~125)   │                  │         │                │
│         │                 │                  │         ▼                │
│  Claude 3-stage analysis  │                  │  D1 (ideas + FTS5)       │
│  (classify → analyze →   │                  │  Durable Objects (rate)   │
│   frameworks)             │                  │                          │
│         │                 │                  │  CF Pages (Astro)        │
│  Push ideas + trends      │                  │    ├─ / (landing + feed) │
│                           │                  │    ├─ /validate          │
│                           │                  │    ├─ /generate          │
│                           │                  │    ├─ /trends            │
│                           │                  │    └─ /ideas/:id         │
└───────────────────────────┘                  └──────────────────────────┘
```

- **Ingestion pipeline** (Python 3.12) runs on KITT, scrapes 12 sources (Reddit, HN, PH, GitHub Trending, Dev.to, Lobste.rs, NewsAPI, Google Trends, Stack Exchange, GitHub Issues, Discourse Forums, PyPI/npm)
- **Pre-filter** keeps top ~125 signals by per-source engagement quotas before Claude API analysis
- **Claude API analysis** produces structured idea briefs with market sizing, competitors, build complexity, 4-dimension scores, rich narrative writeups, validation playbooks, and GTM strategies
- **Cloudflare Workers** (Hono) API with HMAC-authenticated ingest webhook, cursor-paginated list, fuzzy dedup, trends API, Pro export API
- **Cloudflare D1** stores ideas (22 columns), keyword trends, user profiles, subscriptions, saved ideas, chat history
- **Astro + React islands + Tailwind** dark-theme frontend with marketing landing page, constellation hero, data-forward card design, filters, a11y
- **Trends Dashboard** at /trends — keyword trends with volume, growth %, searchable grid, Pro-gated time-series charts
- **OG images** auto-generated per idea for social sharing
- **Clerk auth** with JWT verification in Workers, save/rate ideas
- **Stripe** Pro subscriptions with checkout sessions + webhook lifecycle
- **AI Actions** 5 structured deep dives per idea (market, feasibility, revenue, weekend plan, competitors) via Haiku, 24h cache
- **Idea Generator** personalized idea generation from Smart Match profile via Sonnet, cross-referenced against signal database
- **Validate My Idea** user-submitted idea SWOT analysis via Sonnet, FTS5 similarity matching against 200+ ideas
- **Framework Analysis** 4 plain-language business framework scores per idea (pipeline batch via Sonnet)
- **Durable Object rate limiting** atomic per-feature limits (validate: 1/month free, 10/day Pro; actions: 1/day free, 30/day Pro; generate: 1/day free, 5/day Pro)
- **Email digests** via Resend with user frequency preferences
- **Smart Match** personalized idea scoring for Pro users (skill/niche/budget/complexity fit)
- **Content gating** three-tier visibility — anon sees titles (SEO), free gets 1 full idea/day + product name teaser + AI feature teasers, Pro sees full analysis/frameworks/AI tools
- **Data Export** Pro-only JSON download of all or saved ideas
- **GitHub Actions CI/CD** auto-deploys frontend to CF Pages on push to main

## Project Structure

```
AIdeaPulse/
  pipeline/            # Python ingestion + analysis pipeline (runs on KITT)
    scrapers/          # 12 sources: Reddit, HN, PH, GitHub Trending/Issues, Dev.to, Lobste.rs, NewsAPI, Trends, Stack Exchange, Discourse, PyPI/npm
    analysis/          # Claude API analysis with JSON parsing + confidence rubric
    push/              # HMAC-authenticated webhook push with retry + spool
    prefilter.py       # Per-source engagement quotas (~125 signals total)
    tests/             # 15 pytest tests
  workers/             # Cloudflare Workers API (Hono + TypeScript)
    src/routes/        # ingest, ideas, validate, actions, generate, trends, export, profile, health, og endpoints
    src/helpers/       # ai-helpers.ts (Anthropic client, sanitization, rate limit keys)
    src/scoring/       # fitScore engine + unit tests
    src/               # rate-limiter-do.ts (Durable Object for atomic rate limiting)
    migrations/        # D1 SQL schema (12 migrations including FTS5)
    test/              # vitest + miniflare tests
  frontend/            # Astro + React islands + Tailwind (CF Pages)
    src/components/    # IdeaCard, IdeaFeed, AIActions, FrameworkAnalysis, ValidateForm, ValidationResult, IdeaGenerator, ScoreBreakdown, CommunitySignals, TrendsDashboard, TrendChart, SaveButton, ProfileSetup, ProCheckout, HeaderAuth
    src/pages/         # index, /ideas/[id], /dashboard, /validate, /generate, /trends, /pro, /about, 404
    src/layouts/       # BaseLayout with SEO meta tags
  systemd/             # Timer + service for daily pipeline run
  docs/                # Changelog, roadmap, open items
  decisions/           # Architecture decision records
```

## Development

### Pipeline (Python)
```bash
cd pipeline
source .venv/bin/activate  # venv already created
python -m pytest tests/ -v  # run tests
python -m pipeline.main     # run pipeline (needs API keys in .env)
```

### Workers (TypeScript)
```bash
cd workers
npm install          # already done
npx vitest run       # run tests (23 tests)
npx wrangler dev     # local dev
npx wrangler deploy  # deploy to Cloudflare
```

### Frontend (Astro)
```bash
cd frontend
npm install                    # already done
npm run dev  # uses PUBLIC_API_URL from .env
```

## Security

- All secrets via environment variables (`.env` gitignored)
- HMAC-SHA256 webhook auth with 5-minute timestamp replay protection
- Fuzzy dedup prevents duplicate ideas (word-set Jaccard similarity)
- See `.claude/CLAUDE.md` for full security policy
