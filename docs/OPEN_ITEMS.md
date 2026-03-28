# Open Items

## Decisions Needed
- [x] Product name / domain → AIdeaPulse (aideapulse.com registered on Cloudflare)
- [x] Auth approach → Clerk recommended (Sprint 3)
- [x] Pro tier pricing → $12/mo (decided in office hours)
- [x] Core user persona → solo indie hacker with day job

## Technical Questions
- [x] D1 row limits → 10GB free, fine for year 1
- [x] R2 usage → not needed for MVP, raw data stays on KITT
- [x] KITT->CF auth → HMAC-SHA256 with timestamp replay protection

## Research Needed
- [x] Ideabrowser.com audit → $999/yr Pro, shallow analysis, launched May 2025
- [x] Reddit API rate limits for PRAW → N/A, PRAW removed; scraper uses public .json feeds (no API key)
- [x] Product Hunt API → GraphQL v2, requires OAuth token
- [x] Google Trends → pytrends is unofficial, demoted to optional enrichment

## Waiting On
- [x] Reddit API approval → N/A, using public .json feeds instead of PRAW
- [x] Anthropic API key → configured in pipeline/.env, pipeline running daily since Sprint 2
- [x] Product Hunt API token → configured, PH scraper operational since Sprint 2
