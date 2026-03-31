"""Push analyzed ideas to Cloudflare D1 via authenticated webhook."""

import hashlib
import hmac
import json
import logging
import time
from dataclasses import asdict
from pathlib import Path

import httpx

from pipeline.analysis.analyze import IdeaBrief
from pipeline.config import CloudflareConfig

logger = logging.getLogger("aideapulse.push")

SPOOL_DIR = Path("pipeline/spool")
MAX_RETRIES = 3
BACKOFF_BASE = 2  # seconds


def _generate_signature(payload: bytes, secret: str) -> str:
    """Generate HMAC-SHA256 signature for webhook payload."""
    return hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()


def _spool_to_disk(payload: bytes) -> Path:
    """Save failed payload to local JSON file for manual replay."""
    SPOOL_DIR.mkdir(parents=True, exist_ok=True)
    filename = SPOOL_DIR / f"failed_{int(time.time())}.json"
    filename.write_bytes(payload)
    logger.warning("Spooled failed payload to %s", filename)
    return filename


def push_ideas(
    config: CloudflareConfig,
    ideas: list[IdeaBrief],
) -> dict | None:
    """Push a batch of analyzed ideas to Cloudflare via webhook.

    Uses HMAC-SHA256 signature for auth (timing-safe comparison on Workers side).
    Retries 3x with exponential backoff, then spools to disk on final failure.
    """
    timestamp = str(int(time.time()))
    payload = json.dumps({
        "ideas": [asdict(idea) for idea in ideas],
        "timestamp": int(time.time()),
    }).encode()

    signature = _generate_signature(payload, config.ingest_webhook_secret)

    for attempt in range(MAX_RETRIES):
        try:
            response = httpx.post(
                config.ingest_webhook_url,
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Webhook-Signature": signature,
                    "X-Webhook-Timestamp": timestamp,
                },
                timeout=30,
            )
            response.raise_for_status()
            logger.info("Pushed %d ideas successfully", len(ideas))
            return response.json()
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            wait = BACKOFF_BASE ** (attempt + 1)
            logger.warning(
                "Push attempt %d/%d failed: %s. Retrying in %ds...",
                attempt + 1, MAX_RETRIES, e, wait,
            )
            if attempt < MAX_RETRIES - 1:
                time.sleep(wait)

    logger.error("All %d push attempts failed. Spooling to disk.", MAX_RETRIES)
    _spool_to_disk(payload)
    return None


def push_trends(
    config: CloudflareConfig,
    trend_signals: list,
) -> dict | None:
    """Push Google Trends data to Cloudflare for the trends dashboard.

    Uses the same HMAC auth as push_ideas but targets /api/ingest/trends.
    """
    from pipeline.scrapers.google_trends import TrendSignal

    trends_data = []
    for signal in trend_signals:
        if not isinstance(signal, TrendSignal):
            continue
        trends_data.append({
            "keyword": signal.keyword,
            "source": signal.source,
            "value": signal.value,
            "related_topics": signal.related_topics,
            "interest_over_time": getattr(signal, "interest_over_time", []),
        })

    if not trends_data:
        logger.info("No trend data to push")
        return None

    timestamp = str(int(time.time()))
    payload = json.dumps({
        "trends": trends_data,
        "timestamp": int(time.time()),
    }).encode()

    signature = _generate_signature(payload, config.ingest_webhook_secret)

    # Derive trends URL from the existing webhook URL
    trends_url = config.ingest_webhook_url.replace("/api/ingest", "/api/ingest/trends")

    for attempt in range(MAX_RETRIES):
        try:
            response = httpx.post(
                trends_url,
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Webhook-Signature": signature,
                    "X-Webhook-Timestamp": timestamp,
                },
                timeout=30,
            )
            response.raise_for_status()
            logger.info("Pushed %d trend keywords successfully", len(trends_data))
            return response.json()
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            wait = BACKOFF_BASE ** (attempt + 1)
            logger.warning(
                "Trends push attempt %d/%d failed: %s. Retrying in %ds...",
                attempt + 1, MAX_RETRIES, e, wait,
            )
            if attempt < MAX_RETRIES - 1:
                time.sleep(wait)

    logger.error("All %d trends push attempts failed.", MAX_RETRIES)
    return None
