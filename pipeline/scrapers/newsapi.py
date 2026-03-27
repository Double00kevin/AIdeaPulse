"""NewsAPI scraper. Requires free API key (instant signup at newsapi.org)."""

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger("aideapulse.scrapers.newsapi")

NEWSAPI_URL = "https://newsapi.org/v2/everything"

SEARCH_QUERIES = [
    "startup funding",
    "SaaS launch",
    "developer tools",
    "AI startup",
    "no-code platform",
]


@dataclass
class NewsAPISignal:
    """A raw demand signal from NewsAPI."""

    title: str
    description: str
    url: str
    source_name: str
    published_at: str


def scrape_all(api_key: str, page_size: int = 20) -> list[NewsAPISignal]:
    """Scrape recent startup/SaaS news from NewsAPI."""
    if not api_key:
        logger.warning("No NewsAPI key, skipping")
        return []

    headers = {
        "X-Api-Key": api_key,
        "User-Agent": "AIdeaPulse/0.1",
    }
    signals: list[NewsAPISignal] = []
    seen_urls: set[str] = set()

    for query in SEARCH_QUERIES:
        params = {
            "q": query,
            "sortBy": "relevancy",
            "pageSize": page_size,
            "language": "en",
        }

        try:
            response = httpx.get(
                NEWSAPI_URL, headers=headers, params=params, timeout=15,
            )
            response.raise_for_status()
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.error("NewsAPI error for query '%s': %s", query, e)
            continue

        data = response.json()
        for article in data.get("articles", []):
            url = article.get("url", "")
            if url in seen_urls:
                continue
            seen_urls.add(url)

            signals.append(
                NewsAPISignal(
                    title=article.get("title", ""),
                    description=article.get("description", "")[:1000] if article.get("description") else "",
                    url=url,
                    source_name=article.get("source", {}).get("name", ""),
                    published_at=article.get("publishedAt", ""),
                )
            )

    logger.info("Scraped %d articles from NewsAPI", len(signals))
    return signals
