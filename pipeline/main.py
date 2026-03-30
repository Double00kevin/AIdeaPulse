"""Main pipeline entrypoint. Run via systemd timer or manually."""

import logging
import time

from pipeline.analysis.analyze import IdeaBrief, analyze_signal, classify_signal, create_client
from pipeline.config import load_config
from pipeline.prefilter import (
    filter_devto,
    filter_discourse,
    filter_github_issues,
    filter_github_trending,
    filter_hackernews,
    filter_lobsters,
    filter_newsapi,
    filter_package_trends,
    filter_producthunt,
    filter_reddit,
    filter_stackexchange,
    filter_trends,
)
from pipeline.push.cloudflare import push_ideas
from pipeline.scrapers.devto import DevtoSignal, scrape_all as scrape_devto
from pipeline.scrapers.discourse import DiscourseSignal, scrape_all as scrape_discourse
from pipeline.scrapers.github_issues import GitHubIssueSignal, scrape_all as scrape_gh_issues
from pipeline.scrapers.github_trending import GitHubTrendingSignal, scrape_all as scrape_github
from pipeline.scrapers.google_trends import TrendSignal, scrape_all as scrape_trends
from pipeline.scrapers.hackernews import HackerNewsSignal, scrape_all as scrape_hn
from pipeline.scrapers.lobsters import LobstersSignal, scrape_all as scrape_lobsters
from pipeline.scrapers.newsapi import NewsAPISignal, scrape_all as scrape_news
from pipeline.scrapers.package_trends import PackageTrendSignal, scrape_all as scrape_packages
from pipeline.scrapers.producthunt import ProductHuntSignal, scrape_all as scrape_ph
from pipeline.scrapers.reddit import RedditSignal, scrape_all as scrape_reddit
from pipeline.scrapers.stackexchange import StackExchangeSignal, scrape_all as scrape_se

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("aideapulse.pipeline")

MIN_CONFIDENCE = 30


# ── Signal formatters ──────────────────────────────────────────────────


def _format_reddit_signal(signal: RedditSignal) -> tuple[str, list[str]]:
    """Format a Reddit signal for Claude analysis."""
    text = f"Subreddit: r/{signal.subreddit}\n"
    text += f"Title: {signal.title}\n"
    text += f"Score: {signal.score} | Comments: {signal.num_comments}\n"
    if signal.selftext:
        text += f"Content: {signal.selftext[:1500]}\n"
    return text, [signal.url]


def _format_hn_signal(signal: HackerNewsSignal) -> tuple[str, list[str]]:
    """Format a Hacker News signal for Claude analysis."""
    text = f"Hacker News ({signal.post_type}): {signal.title}\n"
    text += f"Score: {signal.score} | Comments: {signal.num_comments}\n"
    if signal.text:
        text += f"Content: {signal.text[:1500]}\n"
    links = [signal.hn_url]
    if signal.url:
        links.append(signal.url)
    return text, links


def _format_ph_signal(signal: ProductHuntSignal) -> tuple[str, list[str]]:
    """Format a Product Hunt signal for Claude analysis."""
    text = f"Product: {signal.name}\n"
    text += f"Tagline: {signal.tagline}\n"
    text += f"Votes: {signal.votes_count} | Comments: {signal.comments_count}\n"
    if signal.description:
        text += f"Description: {signal.description[:800]}\n"
    if signal.topics:
        text += f"Topics: {', '.join(signal.topics)}\n"
    return text, [signal.url]


def _format_github_signal(signal: GitHubTrendingSignal) -> tuple[str, list[str]]:
    """Format a GitHub Trending signal for Claude analysis."""
    text = f"GitHub Trending: {signal.repo_name}\n"
    if signal.description:
        text += f"Description: {signal.description}\n"
    if signal.language:
        text += f"Language: {signal.language}\n"
    text += f"Stars today: {signal.stars_today} | Total stars: {signal.total_stars}\n"
    return text, [signal.url]


def _format_devto_signal(signal: DevtoSignal) -> tuple[str, list[str]]:
    """Format a Dev.to signal for Claude analysis."""
    text = f"Dev.to article: {signal.title}\n"
    text += f"Reactions: {signal.positive_reactions_count} | Comments: {signal.comments_count}\n"
    if signal.description:
        text += f"Description: {signal.description[:800]}\n"
    if signal.tags:
        text += f"Tags: {', '.join(signal.tags)}\n"
    return text, [signal.url]


def _format_lobsters_signal(signal: LobstersSignal) -> tuple[str, list[str]]:
    """Format a Lobste.rs signal for Claude analysis."""
    text = f"Lobste.rs: {signal.title}\n"
    text += f"Score: {signal.score} | Comments: {signal.comment_count}\n"
    if signal.tags:
        text += f"Tags: {', '.join(signal.tags)}\n"
    return text, [signal.url, signal.comments_url]


def _format_news_signal(signal: NewsAPISignal) -> tuple[str, list[str]]:
    """Format a NewsAPI signal for Claude analysis."""
    text = f"News ({signal.source_name}): {signal.title}\n"
    if signal.description:
        text += f"Description: {signal.description[:800]}\n"
    return text, [signal.url]


def _format_trend_signal(signal: TrendSignal) -> tuple[str, list[str]]:
    """Format a Google Trends signal for Claude analysis."""
    text = f"Trending keyword: {signal.keyword}\n"
    text += f"Type: {signal.source}\n"
    if signal.value:
        text += f"Growth: {signal.value}%\n"
    if signal.related_topics:
        text += f"Related to: {', '.join(signal.related_topics)}\n"
    return text, []


def _format_se_signal(signal: StackExchangeSignal) -> tuple[str, list[str]]:
    """Format a Stack Exchange signal for Claude analysis."""
    answered = "answered" if signal.is_answered else "UNANSWERED"
    text = f"Stack Exchange ({signal.site}): {signal.title}\n"
    text += f"Score: {signal.score} | Views: {signal.view_count} | {answered}\n"
    if signal.tags:
        text += f"Tags: {', '.join(signal.tags)}\n"
    if signal.body_excerpt:
        text += f"Excerpt: {signal.body_excerpt[:800]}\n"
    return text, [signal.url]


def _format_gh_issues_signal(signal: GitHubIssueSignal) -> tuple[str, list[str]]:
    """Format a GitHub Issues signal for Claude analysis."""
    text = f"GitHub Issue ({signal.repo}): {signal.title}\n"
    text += f"Reactions: {signal.reaction_total} (+1: {signal.thumbs_up}) | Comments: {signal.comments}\n"
    if signal.labels:
        text += f"Labels: {', '.join(signal.labels)}\n"
    if signal.body_excerpt:
        text += f"Body: {signal.body_excerpt[:1000]}\n"
    return text, [signal.url]


def _format_discourse_signal(signal: DiscourseSignal) -> tuple[str, list[str]]:
    """Format a Discourse signal for Claude analysis."""
    text = f"Discourse ({signal.instance}): {signal.title}\n"
    text += f"Likes: {signal.like_count} | Replies: {signal.reply_count} | Views: {signal.views}\n"
    if signal.category:
        text += f"Category: {signal.category}\n"
    if signal.tags:
        text += f"Tags: {', '.join(signal.tags)}\n"
    if signal.excerpt:
        text += f"Excerpt: {signal.excerpt[:800]}\n"
    return text, [signal.url]


def _format_package_signal(signal: PackageTrendSignal) -> tuple[str, list[str]]:
    """Format a package trend signal for Claude analysis."""
    text = f"Package ({signal.registry}): {signal.package_name} v{signal.version}\n"
    text += f"Downloads (recent): {signal.downloads_recent:,}\n"
    if signal.description:
        text += f"Description: {signal.description}\n"
    if signal.keywords:
        text += f"Keywords: {', '.join(signal.keywords[:8])}\n"
    return text, [signal.url]


# ── Analysis helpers ───────────────────────────────────────────────────


def _analyze_batch(
    claude_client,
    signals: list,
    formatter,
    source_type: str,
    ideas: list[IdeaBrief],
) -> tuple[int, int]:
    """Two-stage analysis: classify with Haiku, then analyze with Sonnet.

    Returns (total_classified, total_analyzed).
    """
    classified = 0
    analyzed = 0

    for signal in signals:
        text, links = formatter(signal)

        # Stage 1: Classify with Haiku (fast + cheap)
        result = classify_signal(claude_client, text)
        classified += 1

        if result.verdict == "skip":
            logger.debug("Skipped signal (%s): %s", result.category, result.reason)
            continue

        logger.debug("Signal passed classify (%s): %s", result.category, result.reason)

        # Stage 2: Full analysis with Sonnet (only for passing signals)
        brief = analyze_signal(claude_client, text, links, source_type)
        analyzed += 1

        if brief and brief.confidence_score >= MIN_CONFIDENCE:
            ideas.append(brief)
        elif brief:
            logger.debug("Discarded low-confidence idea: %s (%d)",
                         brief.title, brief.confidence_score)

    return classified, analyzed


# ── Main pipeline ──────────────────────────────────────────────────────


def run() -> None:
    """Run the full ingestion pipeline: scrape -> pre-filter -> analyze -> push."""
    start = time.time()
    logger.info("Starting AIdeaPulse ingestion pipeline")

    config = load_config()
    logger.info("Config loaded successfully")

    # Step 1: Scrape signals from all sources
    logger.info("Scraping signals from 12 sources...")
    reddit_signals = scrape_reddit()
    hn_signals = scrape_hn()
    ph_signals = scrape_ph(config.producthunt_access_token)
    github_signals = scrape_github()
    devto_signals = scrape_devto()
    lobsters_signals = scrape_lobsters()
    news_signals = scrape_news(config.newsapi_key)
    trend_signals = scrape_trends()
    se_signals = scrape_se()
    gh_issues_signals = scrape_gh_issues()
    discourse_signals = scrape_discourse()
    package_signals = scrape_packages()

    source_counts = {
        "Reddit": len(reddit_signals),
        "HN": len(hn_signals),
        "PH": len(ph_signals),
        "GitHub": len(github_signals),
        "Dev.to": len(devto_signals),
        "Lobsters": len(lobsters_signals),
        "NewsAPI": len(news_signals),
        "Trends": len(trend_signals),
        "StackExchange": len(se_signals),
        "GH Issues": len(gh_issues_signals),
        "Discourse": len(discourse_signals),
        "Packages": len(package_signals),
    }
    total_raw = sum(source_counts.values())
    logger.info("Raw signals: %d total — %s", total_raw, source_counts)

    # Step 2: Pre-filter by engagement
    logger.info("Pre-filtering signals...")
    reddit_filtered = filter_reddit(reddit_signals)
    hn_filtered = filter_hackernews(hn_signals)
    ph_filtered = filter_producthunt(ph_signals)
    github_filtered = filter_github_trending(github_signals)
    devto_filtered = filter_devto(devto_signals)
    lobsters_filtered = filter_lobsters(lobsters_signals)
    news_filtered = filter_newsapi(news_signals)
    trend_filtered = filter_trends(trend_signals)
    se_filtered = filter_stackexchange(se_signals)
    gh_issues_filtered = filter_github_issues(gh_issues_signals)
    discourse_filtered = filter_discourse(discourse_signals)
    package_filtered = filter_package_trends(package_signals)

    # Step 3: Two-stage analysis with Claude API
    # Stage 1 (Haiku): classify signals as pass/skip — fast + cheap
    # Stage 2 (Sonnet): full analysis on passing signals only
    logger.info("Two-stage analysis: classify (Haiku) then analyze (Sonnet)...")
    claude_client = create_client(config.anthropic_api_key)
    ideas: list[IdeaBrief] = []
    total_classified = 0
    total_analyzed = 0

    batches = [
        (reddit_filtered, _format_reddit_signal, "reddit"),
        (hn_filtered, _format_hn_signal, "hackernews"),
        (ph_filtered, _format_ph_signal, "producthunt"),
        (github_filtered, _format_github_signal, "github_trending"),
        (devto_filtered, _format_devto_signal, "devto"),
        (lobsters_filtered, _format_lobsters_signal, "lobsters"),
        (news_filtered, _format_news_signal, "newsapi"),
        (trend_filtered, _format_trend_signal, "google_trends"),
        (se_filtered, _format_se_signal, "stackexchange"),
        (gh_issues_filtered, _format_gh_issues_signal, "github_issues"),
        (discourse_filtered, _format_discourse_signal, "discourse"),
        (package_filtered, _format_package_signal, "package_trends"),
    ]

    for signals, formatter, source_type in batches:
        classified, analyzed = _analyze_batch(
            claude_client, signals, formatter, source_type, ideas,
        )
        total_classified += classified
        total_analyzed += analyzed

    logger.info("Classified %d signals, analyzed %d (passed classify), produced %d ideas",
                total_classified, total_analyzed, len(ideas))

    # Step 4: Push to Cloudflare (dedup happens in Workers)
    if ideas:
        logger.info("Pushing %d ideas to Cloudflare...", len(ideas))
        result = push_ideas(config.cloudflare, ideas)
        if result:
            logger.info("Push result: %s", result)
        else:
            logger.error("Push failed, ideas spooled to disk")
    else:
        logger.warning("No ideas to push")

    elapsed = time.time() - start
    logger.info("Pipeline complete in %.1fs", elapsed)


if __name__ == "__main__":
    run()
