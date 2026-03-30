"""Pre-filter raw signals by engagement before sending to Claude API.

Per-source quotas:
- Reddit: top 20 by (score + num_comments)
- Hacker News: top 15 by score (prioritize Ask/Show HN)
- Product Hunt: top 5 by votes_count
- GitHub Trending: top 10 by stars_today
- Dev.to: top 10 by (reactions + comments)
- Lobste.rs: top 10 by score
- NewsAPI: top 10 (no engagement metric, just relevancy)
- Google Trends: all signals pass through
- Stack Exchange: top 15 by score (unanswered boosted 2x)
- GitHub Issues: top 15 by reaction count
- Discourse: top 15 by (likes + replies)
- Package Trends: top 15 by recent downloads
"""

import logging

from pipeline.scrapers.reddit import RedditSignal
from pipeline.scrapers.hackernews import HackerNewsSignal
from pipeline.scrapers.producthunt import ProductHuntSignal
from pipeline.scrapers.github_trending import GitHubTrendingSignal
from pipeline.scrapers.devto import DevtoSignal
from pipeline.scrapers.lobsters import LobstersSignal
from pipeline.scrapers.newsapi import NewsAPISignal
from pipeline.scrapers.google_trends import TrendSignal
from pipeline.scrapers.stackexchange import StackExchangeSignal
from pipeline.scrapers.github_issues import GitHubIssueSignal
from pipeline.scrapers.discourse import DiscourseSignal
from pipeline.scrapers.package_trends import PackageTrendSignal

logger = logging.getLogger("aideapulse.prefilter")


def filter_reddit(signals: list[RedditSignal], top_n: int = 20) -> list[RedditSignal]:
    """Keep top N Reddit signals by engagement (score + comments)."""
    sorted_signals = sorted(
        signals,
        key=lambda s: s.score + s.num_comments,
        reverse=True,
    )
    filtered = sorted_signals[:top_n]
    logger.info(
        "Reddit: %d -> %d signals (filtered by engagement)",
        len(signals), len(filtered),
    )
    return filtered


def filter_hackernews(
    signals: list[HackerNewsSignal], top_n: int = 15,
) -> list[HackerNewsSignal]:
    """Keep top N HN signals, prioritizing Ask/Show HN posts."""
    # Boost Ask HN and Show HN posts by 2x their score for sorting
    sorted_signals = sorted(
        signals,
        key=lambda s: s.score * (2 if s.post_type in ("ask", "show") else 1),
        reverse=True,
    )
    filtered = sorted_signals[:top_n]
    logger.info(
        "Hacker News: %d -> %d signals (filtered by score, Ask/Show boosted)",
        len(signals), len(filtered),
    )
    return filtered


def filter_producthunt(
    signals: list[ProductHuntSignal], top_n: int = 5,
) -> list[ProductHuntSignal]:
    """Keep top N Product Hunt signals by vote count."""
    sorted_signals = sorted(
        signals,
        key=lambda s: s.votes_count,
        reverse=True,
    )
    filtered = sorted_signals[:top_n]
    logger.info(
        "Product Hunt: %d -> %d signals (filtered by votes)",
        len(signals), len(filtered),
    )
    return filtered


def filter_github_trending(
    signals: list[GitHubTrendingSignal], top_n: int = 10,
) -> list[GitHubTrendingSignal]:
    """Keep top N GitHub Trending repos by stars today."""
    sorted_signals = sorted(
        signals,
        key=lambda s: s.stars_today,
        reverse=True,
    )
    filtered = sorted_signals[:top_n]
    logger.info(
        "GitHub Trending: %d -> %d signals (filtered by stars today)",
        len(signals), len(filtered),
    )
    return filtered


def filter_devto(
    signals: list[DevtoSignal], top_n: int = 10,
) -> list[DevtoSignal]:
    """Keep top N Dev.to articles by engagement (reactions + comments)."""
    sorted_signals = sorted(
        signals,
        key=lambda s: s.positive_reactions_count + s.comments_count,
        reverse=True,
    )
    filtered = sorted_signals[:top_n]
    logger.info(
        "Dev.to: %d -> %d signals (filtered by engagement)",
        len(signals), len(filtered),
    )
    return filtered


def filter_lobsters(
    signals: list[LobstersSignal], top_n: int = 10,
) -> list[LobstersSignal]:
    """Keep top N Lobste.rs stories by score."""
    sorted_signals = sorted(
        signals,
        key=lambda s: s.score,
        reverse=True,
    )
    filtered = sorted_signals[:top_n]
    logger.info(
        "Lobste.rs: %d -> %d signals (filtered by score)",
        len(signals), len(filtered),
    )
    return filtered


def filter_newsapi(
    signals: list[NewsAPISignal], top_n: int = 10,
) -> list[NewsAPISignal]:
    """Keep top N NewsAPI articles (already sorted by relevancy)."""
    filtered = signals[:top_n]
    logger.info(
        "NewsAPI: %d -> %d signals (top by relevancy)",
        len(signals), len(filtered),
    )
    return filtered


def filter_trends(signals: list[TrendSignal]) -> list[TrendSignal]:
    """Pass all Google Trends signals through (no engagement metric)."""
    logger.info("Google Trends: %d signals (all pass through)", len(signals))
    return signals


def filter_stackexchange(
    signals: list[StackExchangeSignal], top_n: int = 15,
) -> list[StackExchangeSignal]:
    """Keep top N Stack Exchange questions by score, boosting unanswered ones."""
    sorted_signals = sorted(
        signals,
        key=lambda s: s.score * (2 if not s.is_answered else 1),
        reverse=True,
    )
    filtered = sorted_signals[:top_n]
    logger.info(
        "Stack Exchange: %d -> %d signals (filtered by score, unanswered boosted)",
        len(signals), len(filtered),
    )
    return filtered


def filter_github_issues(
    signals: list[GitHubIssueSignal], top_n: int = 15,
) -> list[GitHubIssueSignal]:
    """Keep top N GitHub Issues by reaction count."""
    sorted_signals = sorted(
        signals,
        key=lambda s: s.reaction_total,
        reverse=True,
    )
    filtered = sorted_signals[:top_n]
    logger.info(
        "GitHub Issues: %d -> %d signals (filtered by reactions)",
        len(signals), len(filtered),
    )
    return filtered


def filter_discourse(
    signals: list[DiscourseSignal], top_n: int = 15,
) -> list[DiscourseSignal]:
    """Keep top N Discourse topics by engagement (likes + replies)."""
    sorted_signals = sorted(
        signals,
        key=lambda s: s.like_count + s.reply_count,
        reverse=True,
    )
    filtered = sorted_signals[:top_n]
    logger.info(
        "Discourse: %d -> %d signals (filtered by engagement)",
        len(signals), len(filtered),
    )
    return filtered


def filter_package_trends(
    signals: list[PackageTrendSignal], top_n: int = 15,
) -> list[PackageTrendSignal]:
    """Keep top N packages by recent downloads."""
    sorted_signals = sorted(
        signals,
        key=lambda s: s.downloads_recent,
        reverse=True,
    )
    filtered = sorted_signals[:top_n]
    logger.info(
        "Package Trends: %d -> %d signals (filtered by downloads)",
        len(signals), len(filtered),
    )
    return filtered
