# Changelog

All notable changes to IdeaVault will be documented in this file.

## [Unreleased]

### 2026-03-27 — ba14cb1: OG images, tests, docs cleanup
- feat: OG image endpoint (GET /api/og/:id) — branded SVG per idea for social sharing
- feat: 15 pytest tests for pipeline (prefilter, analysis, push signature)
- feat: vitest + miniflare config for Workers API tests
- docs: cleaned up OPEN_ITEMS.md, checked off roadmap items
- deploy: redeployed Workers API with OG endpoint

### 2026-03-26 — Sprint 2: Core Pipeline + API + Frontend
- feat: complete Reddit scraper with domain-specific subreddits (r/webdev, r/freelance, etc.)
- feat: Product Hunt scraper with date filtering (last 7 days)
- feat: Google Trends scraper (optional enrichment, graceful failure)
- feat: pre-filter module (top 20 Reddit, top 5 PH, all Trends)
- feat: Claude API analysis with JSON parsing, confidence rubric, error handling
- feat: push module with HMAC-only auth, retry 3x + spool to disk
- fix: removed Bearer token leak from webhook auth headers
- fix: added X-Webhook-Timestamp header for replay protection
- feat: D1 schema with JSON columns, normalized title for dedup, indexes
- feat: Hono Workers API (ingest webhook, ideas list/detail, health check)
- feat: fuzzy dedup in Workers (word-set Jaccard similarity >0.85)
- feat: cursor-based pagination with complexity/source/sort filters
- feat: Astro + React islands frontend with Tailwind
- feat: data-forward idea cards (complexity dot, confidence score, expand/collapse)
- feat: filter bar, loading/empty/error states, responsive layout, a11y
- feat: individual idea pages (/ideas/:id) with SEO meta tags
- feat: systemd timer for daily 6am UTC pipeline run
- docs: updated CLAUDE.md, roadmap, architecture for Astro + eng review decisions

### 2026-03-26 — Sprint 1: Foundation
- chore: initial project scaffold — repo structure, CLAUDE.md, pipeline stubs, docs
