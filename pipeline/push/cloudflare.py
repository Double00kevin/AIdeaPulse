"""Push analyzed ideas to Cloudflare D1 via authenticated webhook."""

import hashlib
import hmac
import json
import time
from dataclasses import asdict

import httpx

from pipeline.analysis.analyze import IdeaBrief
from pipeline.config import CloudflareConfig


def _generate_signature(payload: bytes, secret: str) -> str:
    """Generate HMAC-SHA256 signature for webhook payload."""
    return hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()


def push_ideas(
    config: CloudflareConfig,
    ideas: list[IdeaBrief],
) -> dict:
    """Push a batch of analyzed ideas to Cloudflare via webhook.

    Uses HMAC-SHA256 signature for auth (timing-safe comparison on the Workers side).
    """
    payload = json.dumps({
        "ideas": [asdict(idea) for idea in ideas],
        "timestamp": int(time.time()),
    }).encode()

    signature = _generate_signature(payload, config.ingest_webhook_secret)

    response = httpx.post(
        config.ingest_webhook_url,
        content=payload,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
            "Authorization": f"Bearer {config.ingest_webhook_secret}",
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()
