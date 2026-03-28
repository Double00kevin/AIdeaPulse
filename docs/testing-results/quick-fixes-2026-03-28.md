# Quick Fixes Verification — 2026-03-28

## 1. Fix Workers vitest config

**Status:** PASS

Changed `configPath` from `./wrangler.toml` to `./wrangler.jsonc` in `workers/vitest.config.ts`.

- Original error: vitest couldn't find `wrangler.toml`
- After fix: config path resolves correctly. A separate pre-existing issue (`nodejs_compat` flag missing from `wrangler.jsonc`) still prevents full test initialization — not in scope for this fix.
- Commit: `f0dc104`

## 2. Fix /api/profile returning 404 instead of 401

**Status:** PASS (already working)

```bash
curl -s -o /dev/null -w "%{http_code}" https://api.aideapulse.com/api/profile
# → 401
```

The Workers deploy from prompt-007 resolved this. The `requireAuth()` middleware on `profileHandler.use("/*", ...)` and route ordering in `index.ts` are correct. No code change needed.

## 3. Fix localhost fallback in ideas/[id].astro

**Status:** PASS

Changed API base URL fallback in `frontend/src/pages/ideas/[id].astro`:
- From: `"http://localhost:8787/api"`
- To: `"/api"`
- Commit: `6285df9`

Workers redeployed. Version ID: `536ff7dc-18cc-4fcc-9c4b-88d364db63fa`.
