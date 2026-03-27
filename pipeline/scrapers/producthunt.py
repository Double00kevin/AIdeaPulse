"""Product Hunt scraper. Pulls new launches and trending products."""

from dataclasses import dataclass

import httpx


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


PH_GRAPHQL_URL = "https://api.producthunt.com/v2/api/graphql"

POSTS_QUERY = """
query {
  posts(order: VOTES, first: 30) {
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


def scrape_all(access_token: str) -> list[ProductHuntSignal]:
    """Scrape trending products from Product Hunt."""
    if not access_token:
        return []

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    response = httpx.post(
        PH_GRAPHQL_URL,
        json={"query": POSTS_QUERY},
        headers=headers,
        timeout=30,
    )
    response.raise_for_status()
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
                description=node.get("description", "")[:2000],
                votes_count=node["votesCount"],
                comments_count=node.get("commentsCount", 0),
                url=node["url"],
                topics=topics,
                launched_at=node["createdAt"],
            )
        )

    return signals
