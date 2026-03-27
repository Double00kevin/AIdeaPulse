# AIdeaPulse

AI-powered startup idea discovery platform. Scrapes demand signals from 8 sources (Reddit, Hacker News, Product Hunt, GitHub Trending, Dev.to, Lobste.rs, NewsAPI, Google Trends), runs them through Claude API for structured analysis, and serves idea briefs through a web app.

## Status

Sprint 4 (Monetization + Launch) — feature-complete, domain + launch remaining.

**Live:** Workers API at `https://aideapulse-api.double00kevin.workers.dev`

**What's built:** 8-source pipeline → Claude two-stage analysis → D1 storage → Astro frontend with Clerk auth, saved ideas/ratings, email digests, Stripe Pro subscriptions, rate limiting.

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
│         │                 │                  │    ├─ / (idea feed)      │
│  Push to CF webhook       │                  │    └─ /ideas/:id (SEO)   │
└───────────────────────────┘                  └──────────────────────────┘
```

- **Ingestion pipeline** (Python 3.12) runs on KITT, scrapes 8 sources (Reddit, HN, PH, GitHub Trending, Dev.to, Lobste.rs, NewsAPI, Google Trends)
- **Pre-filter** keeps top ~65 signals by per-source engagement quotas before Claude API analysis
- **Claude API analysis** produces structured idea briefs with market sizing, competitors, build complexity, confidence score (0-100)
- **Cloudflare Workers** (Hono) API with HMAC-authenticated ingest webhook, cursor-paginated list, fuzzy dedup
- **Cloudflare D1** stores ideas with JSON columns and normalized title dedup
- **Astro + React islands + Tailwind** frontend with data-forward card design, filters, a11y
- **OG images** auto-generated per idea for social sharing
- **Clerk auth** with JWT verification in Workers, save/rate ideas
- **Stripe** Pro subscriptions with checkout sessions + webhook lifecycle
- **Rate limiting** at edge (free: 50/day, pro: 1000/day)
- **Email digests** via Resend with user frequency preferences

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
    src/routes/        # ingest, ideas, health, og endpoints
    migrations/        # D1 SQL schema
    test/              # vitest + miniflare tests
  frontend/            # Astro + React islands + Tailwind (CF Pages)
    src/components/    # IdeaCard, IdeaFeed, SaveButton, ProCheckout, HeaderAuth
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
PUBLIC_API_URL=https://aideapulse-api.double00kevin.workers.dev/api npm run dev
```

## Security

- All secrets via environment variables (`.env` gitignored)
- HMAC-SHA256 webhook auth with 5-minute timestamp replay protection
- Fuzzy dedup prevents duplicate ideas (word-set Jaccard similarity)
- See `.claude/CLAUDE.md` for full security policy
