"""Lobste.rs scraper using public JSON feed. No auth required."""

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger("ideavault.scrapers.lobsters")

LOBSTERS_URL = "https://lobste.rs"


@dataclass
class LobstersSignal:
    """A raw demand signal from Lobste.rs."""

    title: str
    url: str
    score: int
    comment_count: int
    tags: list[str]
    comments_url: str


def scrape_all(pages: int = 2) -> list[LobstersSignal]:
    """Scrape hottest stories from Lobste.rs."""
    headers = {
        "User-Agent": "IdeaVault/0.1 (demand signal research)",
        "Accept": "application/json",
    }
    signals: list[LobstersSignal] = []

    for page in range(1, pages + 1):
        try:
            response = httpx.get(
                f"{LOBSTERS_URL}/hottest.json",
                params={"page": page},
                headers=headers,
                timeout=15,
            )
            response.raise_for_status()
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.error("Failed to fetch Lobste.rs page %d: %s", page, e)
            continue

        stories = response.json()
        for story in stories:
            signals.append(
                LobstersSignal(
                    title=story.get("title", ""),
                    url=story.get("url", "") or story.get("comments_url", ""),
                    score=story.get("score", 0),
                    comment_count=story.get("comment_count", 0),
                    tags=story.get("tags", []),
                    comments_url=story.get("comments_url", ""),
                )
            )

    logger.info("Scraped %d stories from Lobste.rs", len(signals))
    return signals
