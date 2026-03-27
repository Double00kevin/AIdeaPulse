# ADR-001: Split Infrastructure (KITT + Cloudflare)

**Date:** 2026-03-26
**Status:** Accepted

## Context

AIdeaPulse needs to run Python scraping/analysis (CPU-bound, long-running) and serve a web app (low-latency, globally distributed). Single-platform options considered:
- All on KITT: simple but no edge distribution, single point of failure for user-facing
- All on Cloudflare: Workers can't run Python natively, duration limits on free tier

## Decision

Split infrastructure:
- **KITT** handles ingestion pipeline (Python scrapers + Claude API analysis) on a cron
- **Cloudflare** handles everything user-facing (Workers API, D1 database, Pages frontend, R2 storage)
- KITT pushes analyzed ideas to Cloudflare D1 via authenticated webhook

## Consequences

- Pro: Best tool for each job, Cloudflare edge for users, no Python-in-Workers hacks
- Pro: Free/cheap Cloudflare tier for user-facing infra
- Con: Two environments to manage, need secure KITT->CF auth
- Con: Pipeline failures don't surface to users immediately
