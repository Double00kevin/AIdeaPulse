# AIdeaPulse

AI-powered startup idea discovery platform. Scrapes demand signals from 8 sources (Reddit, Hacker News, Product Hunt, GitHub Trending, Dev.to, Lobste.rs, NewsAPI, Google Trends), runs them through Claude API for structured analysis, and serves idea briefs through a web app.

## Status

Sprint 4 (Monetization + Launch) — domain live, Clerk production auth, homepage redesigned, Smart Match Pro feature, launch remaining.

**Live:** https://aideapulse.com | API: https://api.aideapulse.com

**What's built:** 8-source pipeline → Claude two-stage analysis → D1 storage → dark-theme Astro landing page with constellation hero, marketing sections, Clerk production auth, saved ideas/ratings, email digests, Stripe Pro subscriptions ($12/mo), rate limiting, Smart Match personalized scoring (Pro).

## Architecture

```
KITT (Python 3.12)                              Cloudflare
┌───────────────────────────┐                  ┌──────────────────────────┐
│  systemd timer (daily 6am)│                  │  Hono Worker             │
│         │                 │                  │    ├─ POST /api/ingest   │
│         ▼                 │                  │    ├─ GET /api/ideas     │
│  Scrapers                 │  HMAC-SHA256     │    ├─ GET /api/ideas/:id │
│  ├─ Reddit (10 subs)     │  ──────────────► │    ├─ GET /api/og/:id    │
│  ├─ Product Hunt          │                  │    └─ GET /api/health    │
│  └─ Google Trends         │                  │         │                │
│         │                 │                  │         ▼                │
│  Pre-filter (top 30)     │                  │  D1 (ideas table)        │
│         │                 │                  │                          │
│  Claude API analysis      │                  │  CF Pages (Astro)        │
│         │                 │                  │    ├─ / (landing + feed) │
│  Push to CF webhook       │                  │    └─ /ideas/:id (SEO)   │
└───────────────────────────┘                  └──────────────────────────┘
```

- **Ingestion pipeline** (Python 3.12) runs on KITT, scrapes 8 sources (Reddit, HN, PH, GitHub Trending, Dev.to, Lobste.rs, NewsAPI, Google Trends)
- **Pre-filter** keeps top ~65 signals by per-source engagement quotas before Claude API analysis
- **Claude API analysis** produces structured idea briefs with market sizing, competitors, build complexity, confidence score (0-100)
- **Cloudflare Workers** (Hono) API with HMAC-authenticated ingest webhook, cursor-paginated list, fuzzy dedup
- **Cloudflare D1** stores ideas with JSON columns and normalized title dedup
- **Astro + React islands + Tailwind** dark-theme frontend with marketing landing page, constellation hero, data-forward card design, filters, a11y
- **OG images** auto-generated per idea for social sharing
- **Clerk auth** with JWT verification in Workers, save/rate ideas
- **Stripe** Pro subscriptions with checkout sessions + webhook lifecycle
- **Rate limiting** at edge (free: 50/day, pro: 1000/day)
- **Email digests** via Resend with user frequency preferences
- **Smart Match** personalized idea scoring for Pro users (skill/niche/budget/complexity fit)

## Project Structure

```
AIdeaPulse/
  pipeline/            # Python ingestion + analysis pipeline (runs on KITT)
    scrapers/          # Reddit, HN, PH, GitHub Trending, Dev.to, Lobste.rs, NewsAPI, Trends
    analysis/          # Claude API analysis with JSON parsing + confidence rubric
    push/              # HMAC-authenticated webhook push with retry + spool
    prefilter.py       # Per-source engagement quotas (~65 signals total)
    tests/             # 15 pytest tests
  workers/             # Cloudflare Workers API (Hono + TypeScript)
    src/routes/        # ingest, ideas, profile, health, og endpoints
    src/scoring/       # fitScore engine + unit tests
    migrations/        # D1 SQL schema
    test/              # vitest + miniflare tests
  frontend/            # Astro + React islands + Tailwind (CF Pages)
    src/components/    # IdeaCard, IdeaFeed, SaveButton, ProfileSetup, ProCheckout, HeaderAuth
    src/pages/         # index, /ideas/[id], /dashboard, /pro, /about, 404
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
