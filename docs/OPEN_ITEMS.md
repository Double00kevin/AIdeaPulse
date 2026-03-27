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
- [ ] Reddit API rate limits for PRAW (waiting on API approval)
- [x] Product Hunt API → GraphQL v2, requires OAuth token
- [x] Google Trends → pytrends is unofficial, demoted to optional enrichment

## Waiting On
- [ ] Reddit API approval (application submitted 2026-03-27)
- [ ] Anthropic API key (need to add to pipeline/.env)
- [ ] Product Hunt API token (need to apply)
