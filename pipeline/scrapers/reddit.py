"""Reddit scraper using public .json feeds. No API key required."""

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger("ideavault.scrapers.reddit")

# Builder-focused subreddits (idea discovery)
BUILDER_SUBREDDITS = [
    "SaaS",
    "startups",
    "Entrepreneur",
    "smallbusiness",
    "SideProject",
]

# Domain-specific subreddits (user pain points = higher quality signals)
DOMAIN_SUBREDDITS = [
    "webdev",
    "freelance",
    "accounting",
    "realestate",
    "teachers",
]

TARGET_SUBREDDITS = BUILDER_SUBREDDITS + DOMAIN_SUBREDDITS

HEADERS = {
    "User-Agent": "IdeaVault/0.1 (demand signal research)",
}


@dataclass
class RedditSignal:
    """A raw demand signal extracted from a Reddit post."""

    subreddit: str
    title: str
    selftext: str
    score: int
    num_comments: int
    url: str
    created_utc: float


def scrape_subreddit(
    subreddit_name: str,
    sort: str = "top",
    limit: int = 50,
    time_filter: str = "week",
) -> list[RedditSignal]:
    """Scrape posts from a subreddit using public .json endpoint."""
    url = f"https://www.reddit.com/r/{subreddit_name}/{sort}.json"
    params = {"limit": min(limit, 100), "t": time_filter}

    try:
        response = httpx.get(url, headers=HEADERS, params=params, timeout=15)
        response.raise_for_status()
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.error("Failed to scrape r/%s: %s", subreddit_name, e)
        return []

    data = response.json()
    children = data.get("data", {}).get("children", [])
    signals: list[RedditSignal] = []

    for child in children:
        post = child.get("data", {})
        signals.append(
            RedditSignal(
                subreddit=subreddit_name,
                title=post.get("title", ""),
                selftext=post.get("selftext", "")[:2000],
                score=post.get("score", 0),
                num_comments=post.get("num_comments", 0),
                url=f"https://reddit.com{post.get('permalink', '')}",
                created_utc=post.get("created_utc", 0),
            )
        )

    logger.info("Scraped %d posts from r/%s", len(signals), subreddit_name)
    return signals


def scrape_all(limit: int = 50) -> list[RedditSignal]:
    """Scrape all target subreddits and return combined signals."""
    all_signals: list[RedditSignal] = []

    for sub in TARGET_SUBREDDITS:
        signals = scrape_subreddit(sub, limit=limit)
        all_signals.extend(signals)

    logger.info("Total Reddit signals: %d", len(all_signals))
    return all_signals
