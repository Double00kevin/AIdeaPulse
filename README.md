# IdeaVault

AI-powered startup idea discovery platform. Scrapes demand signals from Reddit, Google Trends, and Product Hunt, runs them through Claude API for structured analysis, and serves idea briefs through a web app.

## Status

Sprint 2 — Code complete. Waiting on Reddit API approval + Anthropic API key for first pipeline run.

**Live:** Workers API at `https://ideavault-api.double00kevin.workers.dev`

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

- **Ingestion pipeline** (Python 3.12) runs on KITT, scrapes 10 subreddits + Product Hunt + Google Trends
- **Pre-filter** keeps top 30 signals by engagement, sends to Claude API (~$0.60/day)
- **Claude API analysis** produces structured idea briefs with market sizing, competitors, build complexity, confidence score (0-100)
- **Cloudflare Workers** (Hono) API with HMAC-authenticated ingest webhook, cursor-paginated list, fuzzy dedup
- **Cloudflare D1** stores ideas with JSON columns and normalized title dedup
- **Astro + React islands + Tailwind** frontend with data-forward card design, filters, a11y
- **OG images** auto-generated per idea for social sharing

## Project Structure

```
IdeaVault/
  pipeline/            # Python ingestion + analysis pipeline (runs on KITT)
    scrapers/          # Reddit (PRAW), Google Trends (pytrends), Product Hunt (GraphQL)
    analysis/          # Claude API analysis with JSON parsing + confidence rubric
    push/              # HMAC-authenticated webhook push with retry + spool
    prefilter.py       # Pre-filter top 30 signals by engagement
    tests/             # 15 pytest tests
  workers/             # Cloudflare Workers API (Hono + TypeScript)
    src/routes/        # ingest, ideas, health, og endpoints
    migrations/        # D1 SQL schema
    test/              # vitest + miniflare tests
  frontend/            # Astro + React islands + Tailwind (CF Pages)
    src/components/    # IdeaCard, IdeaFeed (React islands)
    src/pages/         # index, /ideas/[id]
    src/layouts/       # BaseLayout with SEO meta tags
  systemd/             # Timer + service for daily pipeline run
  docs/                # Changelog, roadmap, open items
  decisions/           # Architecture decision records
```

## Monetization

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 3 ideas/day, browse feed |
| Pro | $12/mo | Unlimited, save, filter, search |

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
PUBLIC_API_URL=https://ideavault-api.double00kevin.workers.dev/api npm run dev
```

## Security

- All secrets via environment variables (`.env` gitignored)
- HMAC-SHA256 webhook auth with 5-minute timestamp replay protection
- Fuzzy dedup prevents duplicate ideas (word-set Jaccard similarity)
- See `.claude/CLAUDE.md` for full security policy
