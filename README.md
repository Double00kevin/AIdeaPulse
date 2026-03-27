# IdeaVault

AI-powered startup idea discovery platform. Scrapes demand signals from Reddit, Google Trends, and Product Hunt, runs them through Claude API for structured analysis, and serves idea briefs through a web app.

## Status

Sprint 1 — Foundation (scaffolding, architecture decisions, product discovery)

## Architecture

- **Ingestion pipeline** (Python 3.12) runs on KITT, scrapes sources on a cron
- **Claude API analysis** produces structured idea briefs with market sizing, competitors, build complexity
- **Cloudflare Workers** API serves ideas to the frontend
- **Cloudflare D1** stores ideas, users, ratings
- **React + Vite + Tailwind** frontend on Cloudflare Pages
- **Stripe** handles free/pro/API tier billing

## Project Structure

```
IdeaVault/
  pipeline/          # Python ingestion + analysis pipeline (runs on KITT)
    scrapers/        # Reddit, Google Trends, Product Hunt scrapers
    analysis/        # Claude API analysis module
    push/            # Push analyzed ideas to Cloudflare D1
  workers/           # Cloudflare Workers API (TypeScript)
  frontend/          # React + Vite + Tailwind (Cloudflare Pages)
  docs/              # Changelog, roadmap, open items
  decisions/         # Architecture decision records
```

## Monetization

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 5 ideas/day, no saves, no filters |
| Pro | $9-19/mo | Unlimited, saves, filters, email digest |
| API | $49-99/mo | Programmatic access |

## Development

### Pipeline (Python)
```bash
cd pipeline
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in API keys
```

### Workers (TypeScript)
```bash
cd workers
npm install
npx wrangler dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Security

All secrets via environment variables. See `.claude/CLAUDE.md` for full security policy.
