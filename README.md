# AIdeaPulse

AI-powered startup idea discovery platform. Scrapes demand signals from 12 sources (Reddit, Hacker News, Product Hunt, GitHub Trending, Dev.to, Lobste.rs, NewsAPI, Google Trends, Stack Exchange, GitHub Issues, Discourse Forums, PyPI/npm), runs them through Claude API for structured analysis, and serves idea briefs through a web app.

## Status

Sprint 5 complete (Match Ideabrowser Core) — 201 ideas in production with rich narratives, multi-dimensional scores, community signals, trends dashboard, and data export. GitHub Actions CI/CD. Sprint 6 (AI tools) planned.

**Live:** https://aideapulse.com | API: https://api.aideapulse.com | Trends: https://aideapulse.com/trends

**What's built:** 12-source pipeline → Claude two-stage analysis → D1 storage → dark-theme Astro landing page with full-page constellation background, animated ECG heartbeat dividers, "Today's Idea" free card + locked titles teaser, Clerk production auth, saved ideas/ratings, email digests, Stripe Pro subscriptions ($12/mo), rate limiting, Smart Match personalized scoring (Pro), rich narrative writeups with product names/validation playbooks/GTM strategies, 4-dimension score breakdowns, community signal cards, trends dashboard, Pro-only JSON data export.

## Architecture

```
KITT (Python 3.12)                              Cloudflare
┌───────────────────────────┐                  ┌──────────────────────────┐
│  systemd timer (23:00 CT) │                  │  Hono Worker             │
│         │                 │                  │    ├─ POST /api/ingest   │
│         ▼                 │                  │    ├─ POST /api/trends   │
│  12 Scrapers              │  HMAC-SHA256     │    ├─ GET /api/ideas     │
│  ├─ Reddit, HN, PH …    │  ──────────────► │    ├─ GET /api/trends    │
│  ├─ SE, GH Issues …      │                  │    ├─ GET /api/export    │
│  └─ Discourse, PyPI/npm  │                  │    └─ GET /api/health    │
│         │                 │                  │         │                │
│  Pre-filter (top ~125)   │                  │         ▼                │
│         │                 │                  │  D1 (ideas + trends)     │
│  Claude API analysis      │                  │                          │
│  (narratives + scores)    │                  │  CF Pages (Astro)        │
│         │                 │                  │    ├─ / (landing + feed) │
│  Push ideas + trends      │                  │    ├─ /trends (dashboard)│
│                           │                  │    └─ /ideas/:id (SEO)   │
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
- **Rate limiting** at edge (free: 50/day, pro: 1000/day)
- **Email digests** via Resend with user frequency preferences
- **Smart Match** personalized idea scoring for Pro users (skill/niche/budget/complexity fit)
- **Content gating** three-tier visibility — anon sees titles (SEO), free gets 1 full idea/day + product name teaser, Pro sees full narrative/scores/signals/export
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
    src/routes/        # ingest, ideas, trends, export, profile, health, og endpoints
    src/scoring/       # fitScore engine + unit tests
    migrations/        # D1 SQL schema (8 migrations)
    test/              # vitest + miniflare tests
  frontend/            # Astro + React islands + Tailwind (CF Pages)
    src/components/    # IdeaCard, IdeaFeed, ScoreBreakdown, CommunitySignals, TrendsDashboard, TrendChart, SaveButton, ProfileSetup, ProCheckout, HeaderAuth
    src/pages/         # index, /ideas/[id], /dashboard, /trends, /pro, /about, 404
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
