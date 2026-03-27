"""GitHub Trending scraper. Parses the public trending page — no auth required."""

import logging
import re
from dataclasses import dataclass

import httpx

logger = logging.getLogger("aideapulse.scrapers.github_trending")

TRENDING_URL = "https://github.com/trending"


@dataclass
class GitHubTrendingSignal:
    """A raw demand signal from GitHub Trending."""

    repo_name: str  # "owner/repo"
    description: str
    language: str
    stars_today: int
    total_stars: int
    url: str


def _parse_number(text: str) -> int:
    """Parse a number string like '1,234' or '1.2k' into int."""
    text = text.strip().replace(",", "")
    if not text:
        return 0
    if text.lower().endswith("k"):
        return int(float(text[:-1]) * 1000)
    try:
        return int(text)
    except ValueError:
        return 0


def _parse_trending_html(html: str) -> list[GitHubTrendingSignal]:
    """Parse GitHub trending page HTML without BeautifulSoup.

    Uses regex patterns against the known structure of the trending page.
    """
    signals: list[GitHubTrendingSignal] = []

    # Each repo is in an <article> tag
    articles = re.findall(r"<article[^>]*>(.*?)</article>", html, re.DOTALL)

    for article in articles:
        # Repo name: e.g. /owner/repo in an h2 > a tag
        repo_match = re.search(r'<h2[^>]*>.*?<a[^>]*href="(/[^"]+)"', article, re.DOTALL)
        if not repo_match:
            continue
        repo_path = repo_match.group(1).strip("/")

        # Description
        desc_match = re.search(r'<p[^>]*class="[^"]*col-9[^"]*"[^>]*>(.*?)</p>', article, re.DOTALL)
        description = re.sub(r"<[^>]+>", "", desc_match.group(1)).strip() if desc_match else ""

        # Language
        lang_match = re.search(r'<span[^>]*itemprop="programmingLanguage"[^>]*>(.*?)</span>', article, re.DOTALL)
        language = lang_match.group(1).strip() if lang_match else ""

        # Total stars
        stars_match = re.search(
            r'<a[^>]*href="/' + re.escape(repo_path) + r'/stargazers"[^>]*>(.*?)</a>',
            article, re.DOTALL,
        )
        total_stars = _parse_number(re.sub(r"<[^>]+>", "", stars_match.group(1))) if stars_match else 0

        # Stars today
        today_match = re.search(r"([\d,]+)\s+stars?\s+today", article)
        stars_today = _parse_number(today_match.group(1)) if today_match else 0

        signals.append(
            GitHubTrendingSignal(
                repo_name=repo_path,
                description=description,
                language=language,
                stars_today=stars_today,
                total_stars=total_stars,
                url=f"https://github.com/{repo_path}",
            )
        )

    return signals


def scrape_all(time_range: str = "weekly") -> list[GitHubTrendingSignal]:
    """Scrape GitHub trending repos.

    Args:
        time_range: "daily", "weekly", or "monthly"
    """
    params = {"since": time_range}
    headers = {
        "User-Agent": "AIdeaPulse/0.1 (demand signal research)",
        "Accept": "text/html",
    }

    try:
        response = httpx.get(TRENDING_URL, params=params, headers=headers, timeout=15)
        response.raise_for_status()
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.error("Failed to fetch GitHub Trending: %s", e)
        return []

    signals = _parse_trending_html(response.text)
    logger.info("Scraped %d repos from GitHub Trending (%s)", len(signals), time_range)
    return signals
