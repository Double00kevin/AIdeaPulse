"""Hacker News scraper using the free Firebase API. No auth required."""

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger("ideavault.scrapers.hackernews")

HN_API_BASE = "https://hacker-news.firebaseio.com/v0"

# "Ask HN" and "Show HN" are the best demand signals
ASK_HN_PREFIX = "Ask HN:"
SHOW_HN_PREFIX = "Show HN:"


@dataclass
class HackerNewsSignal:
    """A raw demand signal from Hacker News."""

    title: str
    url: str
    score: int
    num_comments: int
    post_type: str  # "ask", "show", "story"
    hn_url: str
    text: str  # self-text for Ask HN posts
    created_utc: float


def _fetch_item(client: httpx.Client, item_id: int) -> dict | None:
    """Fetch a single HN item by ID."""
    try:
        resp = client.get(f"{HN_API_BASE}/item/{item_id}.json", timeout=10)
        resp.raise_for_status()
        return resp.json()
    except (httpx.HTTPStatusError, httpx.RequestError):
        return None


def _classify_post(title: str) -> str:
    """Classify a post as ask, show, or story."""
    if title.startswith(ASK_HN_PREFIX):
        return "ask"
    if title.startswith(SHOW_HN_PREFIX):
        return "show"
    return "story"


def scrape_top(limit: int = 60) -> list[HackerNewsSignal]:
    """Scrape top stories from Hacker News."""
    try:
        resp = httpx.get(f"{HN_API_BASE}/topstories.json", timeout=15)
        resp.raise_for_status()
        story_ids = resp.json()[:limit]
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.error("Failed to fetch HN top stories: %s", e)
        return []

    signals: list[HackerNewsSignal] = []
    with httpx.Client() as client:
        for item_id in story_ids:
            item = _fetch_item(client, item_id)
            if not item or item.get("type") != "story":
                continue

            title = item.get("title", "")
            signals.append(
                HackerNewsSignal(
                    title=title,
                    url=item.get("url", ""),
                    score=item.get("score", 0),
                    num_comments=item.get("descendants", 0),
                    post_type=_classify_post(title),
                    hn_url=f"https://news.ycombinator.com/item?id={item_id}",
                    text=item.get("text", "")[:2000] if item.get("text") else "",
                    created_utc=item.get("time", 0),
                )
            )

    logger.info("Scraped %d stories from Hacker News", len(signals))
    return signals


def scrape_ask_and_show(limit: int = 30) -> list[HackerNewsSignal]:
    """Scrape Ask HN and Show HN stories specifically."""
    signals: list[HackerNewsSignal] = []

    for endpoint in ("askstories", "showstories"):
        try:
            resp = httpx.get(f"{HN_API_BASE}/{endpoint}.json", timeout=15)
            resp.raise_for_status()
            story_ids = resp.json()[:limit]
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.error("Failed to fetch HN %s: %s", endpoint, e)
            continue

        with httpx.Client() as client:
            for item_id in story_ids:
                item = _fetch_item(client, item_id)
                if not item:
                    continue

                title = item.get("title", "")
                signals.append(
                    HackerNewsSignal(
                        title=title,
                        url=item.get("url", ""),
                        score=item.get("score", 0),
                        num_comments=item.get("descendants", 0),
                        post_type=_classify_post(title),
                        hn_url=f"https://news.ycombinator.com/item?id={item_id}",
                        text=item.get("text", "")[:2000] if item.get("text") else "",
                        created_utc=item.get("time", 0),
                    )
                )

    logger.info("Scraped %d Ask/Show HN stories", len(signals))
    return signals


def scrape_all() -> list[HackerNewsSignal]:
    """Scrape top stories + Ask HN + Show HN, deduplicated."""
    top = scrape_top(limit=60)
    ask_show = scrape_ask_and_show(limit=30)

    # Deduplicate by HN URL
    seen: set[str] = set()
    combined: list[HackerNewsSignal] = []
    for signal in top + ask_show:
        if signal.hn_url not in seen:
            seen.add(signal.hn_url)
            combined.append(signal)

    logger.info("Total Hacker News signals: %d (deduplicated)", len(combined))
    return combined
