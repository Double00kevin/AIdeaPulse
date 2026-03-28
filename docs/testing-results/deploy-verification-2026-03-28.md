# Deploy Verification — 2026-03-28

## 1. Deploy Workers to production

**Status:** PASS

Deployed via `npx wrangler deploy`:
- Upload: 623.25 KiB / gzip: 102.82 KiB
- Startup time: 11 ms
- Version ID: `13cec909-ecaa-4073-b873-ad616480b30a`

### Content gating verification

```bash
curl -s https://api.aideapulse.com/api/ideas?limit=1 | python3 -m json.tool
```

Response:

```json
{
    "ideas": [
        {
            "id": "c3505107-b00d-42f6-8b43-897fdc26367a",
            "title": "AI Dev Workflow HUD: Real-Time Agent Visibility Layer",
            "source_type": "github_trending",
            "confidence_score": 42,
            "created_at": "2026-03-27 13:57:16",
            "build_complexity": "medium"
        }
    ],
    "next_cursor": "2026-03-27 13:57:16",
    "has_more": true,
    "tier": "anon"
}
```

Unauthenticated response correctly omits: `one_liner`, `problem_statement`, `target_audience`, `market_size`, `competitors`, `build_timeline`, `monetization_angle`, `source_links`.

## 2. Update pipeline webhook URL

**Status:** PASS

Changed `INGEST_WEBHOOK_URL` in `pipeline/.env`:
- From: `https://aideapulse-api.double00kevin.workers.dev/api/ingest`
- To: `https://api.aideapulse.com/api/ingest`

## 3. Increase systemd timeout + reschedule timer

**Status:** PASS

Applied by user:
- Service: `TimeoutStartSec=18000` (5 hours, was 600s) — allows full run window through 04:00
- Timer: runs at 23:00 Central nightly (was 06:00 UTC), using `TimezoneOfTimer=America/Chicago` for DST auto-adjust
