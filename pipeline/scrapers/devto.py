"""Dev.to scraper using public API. No auth required."""

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger("ideavault.scrapers.devto")

DEVTO_API = "https://dev.to/api/articles"


@dataclass
class DevtoSignal:
    """A raw demand signal from Dev.to."""

    title: str
    description: str
    url: str
    positive_reactions_count: int
    comments_count: int
    tags: list[str]
    published_at: str


def scrape_all(days_back: int = 7, per_page: int = 30) -> list[DevtoSignal]:
    """Scrape top Dev.to articles from the past week."""
    headers = {
        "User-Agent": "IdeaVault/0.1 (demand signal research)",
    }
    params = {
        "top": days_back,
        "per_page": per_page,
    }

    try:
        response = httpx.get(DEVTO_API, headers=headers, params=params, timeout=15)
        response.raise_for_status()
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.error("Failed to fetch Dev.to articles: %s", e)
        return []

    articles = response.json()
    signals: list[DevtoSignal] = []

    for article in articles:
        signals.append(
            DevtoSignal(
                title=article.get("title", ""),
                description=article.get("description", "")[:1000],
                url=article.get("url", ""),
                positive_reactions_count=article.get("positive_reactions_count", 0),
                comments_count=article.get("comments_count", 0),
                tags=article.get("tag_list", []),
                published_at=article.get("published_at", ""),
            )
        )

    logger.info("Scraped %d articles from Dev.to", len(signals))
    return signals
