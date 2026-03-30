"""GitHub Issues scraper using the REST search API. Works without auth (60 req/hr)."""

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger("aideapulse.scrapers.github_issues")

GH_API_BASE = "https://api.github.com"

# Search queries that surface demand signals (feature requests with high engagement)
SEARCH_QUERIES = [
    "is:issue is:open label:enhancement sort:reactions-+1-desc reactions:>10",
    "is:issue is:open label:feature-request sort:reactions-+1-desc reactions:>10",
    'is:issue is:open "I wish" OR "would be great" OR "please add" sort:reactions-+1-desc reactions:>5',
]


@dataclass
class GitHubIssueSignal:
    """A raw demand signal from GitHub Issues."""

    repo: str  # "owner/repo"
    title: str
    body_excerpt: str
    reaction_total: int
    thumbs_up: int
    comments: int
    labels: list[str]
    url: str  # HTML URL for the issue
    created_at: str


def _scrape_query(
    client: httpx.Client,
    query: str,
    per_page: int = 30,
) -> list[GitHubIssueSignal]:
    """Run a single GitHub issue search query."""
    params = {
        "q": query,
        "sort": "reactions-+1",
        "order": "desc",
        "per_page": per_page,
    }

    try:
        resp = client.get(
            f"{GH_API_BASE}/search/issues",
            params=params,
            timeout=20,
        )
        resp.raise_for_status()
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.error("GitHub Issues search failed: %s", e)
        return []

    data = resp.json()
    signals: list[GitHubIssueSignal] = []

    for item in data.get("items", []):
        # Extract repo name from repository_url
        repo_url = item.get("repository_url", "")
        repo = "/".join(repo_url.split("/")[-2:]) if repo_url else ""

        reactions = item.get("reactions", {})
        body = item.get("body") or ""

        signals.append(
            GitHubIssueSignal(
                repo=repo,
                title=item.get("title", ""),
                body_excerpt=body[:1500],
                reaction_total=reactions.get("total_count", 0),
                thumbs_up=reactions.get("+1", 0),
                comments=item.get("comments", 0),
                labels=[lbl.get("name", "") for lbl in item.get("labels", [])],
                url=item.get("html_url", ""),
                created_at=item.get("created_at", ""),
            )
        )

    logger.info(
        "GitHub Issues query returned %d results (total: %d)",
        len(signals), data.get("total_count", 0),
    )
    return signals


def scrape_all() -> list[GitHubIssueSignal]:
    """Scrape high-demand GitHub Issues across multiple search queries."""
    all_signals: list[GitHubIssueSignal] = []

    headers = {
        "User-Agent": "AIdeaPulse/0.1 (demand signal research)",
        "Accept": "application/vnd.github+json",
    }

    with httpx.Client(headers=headers) as client:
        for query in SEARCH_QUERIES:
            signals = _scrape_query(client, query)
            all_signals.extend(signals)

    # Deduplicate by issue URL
    seen: set[str] = set()
    deduped: list[GitHubIssueSignal] = []
    for signal in all_signals:
        if signal.url not in seen:
            seen.add(signal.url)
            deduped.append(signal)

    # Sort by reaction count descending
    deduped.sort(key=lambda s: s.reaction_total, reverse=True)

    logger.info("Total GitHub Issues signals: %d (deduplicated)", len(deduped))
    return deduped
