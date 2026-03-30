"""Discourse Forums scraper. Fetches top posts from public Discourse instances via REST API."""

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger("aideapulse.scrapers.discourse")

# Public Discourse instances with active product-feedback communities
INSTANCES = [
    {"name": "OpenAI", "base_url": "https://community.openai.com"},
    {"name": "Fly.io", "base_url": "https://community.fly.io"},
    {"name": "Netlify", "base_url": "https://answers.netlify.com"},
    {"name": "Discourse Meta", "base_url": "https://meta.discourse.org"},
    {"name": "Grafana", "base_url": "https://community.grafana.com"},
    {"name": "Elastic", "base_url": "https://discuss.elastic.co"},
]


@dataclass
class DiscourseSignal:
    """A raw demand signal from a Discourse forum."""

    instance: str  # e.g. "OpenAI", "Cloudflare"
    title: str
    excerpt: str
    like_count: int
    reply_count: int
    views: int
    category: str
    tags: list[str]
    url: str
    created_at: str


def _scrape_instance(
    client: httpx.Client,
    name: str,
    base_url: str,
    limit: int = 30,
) -> list[DiscourseSignal]:
    """Scrape top topics from a single Discourse instance."""
    signals: list[DiscourseSignal] = []

    # Fetch top topics (weekly is a good signal window)
    try:
        resp = client.get(
            f"{base_url}/top.json",
            params={"period": "weekly"},
            timeout=15,
        )
        resp.raise_for_status()
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.error("Failed to fetch %s Discourse topics: %s", name, e)
        return []

    data = resp.json()
    topics = data.get("topic_list", {}).get("topics", [])[:limit]

    # Build category lookup from response
    categories = {
        c.get("id"): c.get("name", "")
        for c in data.get("topic_list", {}).get("categories", [])
    }
    # Also check top-level categories key
    for c in data.get("categories", []):
        categories[c.get("id")] = c.get("name", "")

    for topic in topics:
        topic_id = topic.get("id", "")
        slug = topic.get("slug", "")
        cat_id = topic.get("category_id")
        cat_name = categories.get(cat_id, "")

        signals.append(
            DiscourseSignal(
                instance=name,
                title=topic.get("title", ""),
                excerpt=topic.get("excerpt", "")[:800] if topic.get("excerpt") else "",
                like_count=topic.get("like_count", 0),
                reply_count=topic.get("reply_count", 0),
                views=topic.get("views", 0),
                category=cat_name,
                tags=topic.get("tags", []) or [],
                url=f"{base_url}/t/{slug}/{topic_id}",
                created_at=topic.get("created_at", ""),
            )
        )

    logger.info("Scraped %d topics from %s Discourse", len(signals), name)
    return signals


def scrape_all() -> list[DiscourseSignal]:
    """Scrape top topics across all configured Discourse instances."""
    all_signals: list[DiscourseSignal] = []

    with httpx.Client(
        headers={"User-Agent": "AIdeaPulse/0.1 (demand signal research)"},
    ) as client:
        for instance in INSTANCES:
            signals = _scrape_instance(
                client,
                instance["name"],
                instance["base_url"],
            )
            all_signals.extend(signals)

    logger.info("Total Discourse signals: %d", len(all_signals))
    return all_signals
