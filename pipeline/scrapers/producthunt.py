"""Product Hunt scraper. Pulls recent launches via GraphQL API."""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

logger = logging.getLogger("aideapulse.scrapers.producthunt")

PH_GRAPHQL_URL = "https://api.producthunt.com/v2/api/graphql"


@dataclass
class ProductHuntSignal:
    """A raw demand signal from Product Hunt."""

    name: str
    tagline: str
    description: str
    votes_count: int
    comments_count: int
    url: str
    topics: list[str]
    launched_at: str


def _build_query(posted_after: str) -> str:
    """Build GraphQL query with date filter."""
    return """
query($postedAfter: DateTime) {
  posts(order: VOTES, first: 30, postedAfter: $postedAfter) {
    edges {
      node {
        name
        tagline
        description
        votesCount
        commentsCount
        url
        createdAt
        topics(first: 5) {
          edges {
            node {
              name
            }
          }
        }
      }
    }
  }
}
"""


def scrape_all(access_token: str, days_back: int = 7) -> list[ProductHuntSignal]:
    """Scrape recent products from Product Hunt (last N days)."""
    if not access_token:
        logger.warning("No Product Hunt access token, skipping")
        return []

    posted_after = (
        datetime.now(timezone.utc) - timedelta(days=days_back)
    ).isoformat()

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    try:
        response = httpx.post(
            PH_GRAPHQL_URL,
            json={
                "query": _build_query(posted_after),
                "variables": {"postedAfter": posted_after},
            },
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.error("Product Hunt API error: %s", e)
        return []

    data = response.json()
    signals: list[ProductHuntSignal] = []
    edges = data.get("data", {}).get("posts", {}).get("edges", [])

    for edge in edges:
        node = edge["node"]
        topics = [
            t["node"]["name"]
            for t in node.get("topics", {}).get("edges", [])
        ]
        signals.append(
            ProductHuntSignal(
                name=node["name"],
                tagline=node["tagline"],
                description=node.get("description", "")[:1000],
                votes_count=node["votesCount"],
                comments_count=node.get("commentsCount", 0),
                url=node["url"],
                topics=topics,
                launched_at=node["createdAt"],
            )
        )

    logger.info("Scraped %d products from Product Hunt", len(signals))
    return signals
