"""Stack Exchange scraper using the free REST API. No auth required (10K req/day with key)."""

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger("aideapulse.scrapers.stackexchange")

SE_API_BASE = "https://api.stackexchange.com/2.3"

# Sites and tags that surface startup/builder demand signals
# Tags joined by semicolons are OR'd by the SE API
TARGETS: list[dict[str, str | list[str]]] = [
    {"site": "stackoverflow", "tagged": ["rest"]},
    {"site": "stackoverflow", "tagged": ["automation"]},
    {"site": "stackoverflow", "tagged": ["web-scraping"]},
    {"site": "softwareengineering", "tagged": ["architecture", "design-patterns"]},
    {"site": "softwareengineering", "tagged": ["microservices", "api-design"]},
    {"site": "ux", "tagged": ["usability"]},
    {"site": "ux", "tagged": ["user-behavior"]},
    {"site": "webapps", "tagged": ["automation"]},
    {"site": "serverfault", "tagged": ["automation", "monitoring"]},
]

# Common filter for question body excerpts (avoids large HTML bodies)
# "!nNPvSNdWme" is a default filter; we use withbody for excerpts
SE_FILTER = "!nNPvSNdWme"


@dataclass
class StackExchangeSignal:
    """A raw demand signal from Stack Exchange."""

    title: str
    body_excerpt: str
    score: int
    view_count: int
    answer_count: int
    is_answered: bool
    tags: list[str]
    site: str
    url: str
    created_utc: float


def _scrape_site(
    client: httpx.Client,
    site: str,
    tagged: list[str],
    page_size: int = 50,
) -> list[StackExchangeSignal]:
    """Scrape highly-voted questions from a single SE site."""
    params: dict[str, str | int] = {
        "order": "desc",
        "sort": "votes",
        "site": site,
        "pagesize": page_size,
        "filter": SE_FILTER,
    }
    if tagged:
        params["tagged"] = ";".join(tagged)

    try:
        resp = client.get(
            f"{SE_API_BASE}/questions",
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.error("Failed to fetch %s questions: %s", site, e)
        return []

    data = resp.json()
    signals: list[StackExchangeSignal] = []

    for item in data.get("items", []):
        signals.append(
            StackExchangeSignal(
                title=item.get("title", ""),
                body_excerpt=item.get("body_markdown", "")[:1000]
                if item.get("body_markdown")
                else "",
                score=item.get("score", 0),
                view_count=item.get("view_count", 0),
                answer_count=item.get("answer_count", 0),
                is_answered=item.get("is_answered", False),
                tags=item.get("tags", []),
                site=site,
                url=item.get("link", ""),
                created_utc=item.get("creation_date", 0),
            )
        )

    quota_remaining = data.get("quota_remaining", "?")
    logger.info(
        "Scraped %d questions from %s (quota remaining: %s)",
        len(signals), site, quota_remaining,
    )
    return signals


def scrape_all() -> list[StackExchangeSignal]:
    """Scrape highly-voted questions across multiple Stack Exchange sites."""
    all_signals: list[StackExchangeSignal] = []

    with httpx.Client(
        headers={"User-Agent": "AIdeaPulse/0.1 (demand signal research)"},
    ) as client:
        for target in TARGETS:
            site = str(target["site"])
            tagged = list(target.get("tagged", []))
            signals = _scrape_site(client, site, tagged)
            all_signals.extend(signals)

    # Deduplicate by URL
    seen: set[str] = set()
    deduped: list[StackExchangeSignal] = []
    for signal in all_signals:
        if signal.url not in seen:
            seen.add(signal.url)
            deduped.append(signal)

    logger.info("Total Stack Exchange signals: %d (deduplicated)", len(deduped))
    return deduped
