"""Reddit scraper using PRAW. Pulls demand signals from startup/SaaS subreddits."""

from dataclasses import dataclass

import praw

from pipeline.config import RedditConfig

TARGET_SUBREDDITS = [
    "SaaS",
    "startups",
    "Entrepreneur",
    "smallbusiness",
    "SideProject",
]


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


def create_client(config: RedditConfig) -> praw.Reddit:
    """Create an authenticated Reddit client."""
    return praw.Reddit(
        client_id=config.client_id,
        client_secret=config.client_secret,
        user_agent=config.user_agent,
    )


def scrape_subreddit(
    client: praw.Reddit,
    subreddit_name: str,
    limit: int = 50,
    time_filter: str = "week",
) -> list[RedditSignal]:
    """Scrape top posts from a subreddit for demand signals."""
    subreddit = client.subreddit(subreddit_name)
    signals: list[RedditSignal] = []

    for post in subreddit.top(time_filter=time_filter, limit=limit):
        signals.append(
            RedditSignal(
                subreddit=subreddit_name,
                title=post.title,
                selftext=post.selftext[:2000],  # truncate long posts
                score=post.score,
                num_comments=post.num_comments,
                url=f"https://reddit.com{post.permalink}",
                created_utc=post.created_utc,
            )
        )

    return signals


def scrape_all(config: RedditConfig, limit: int = 50) -> list[RedditSignal]:
    """Scrape all target subreddits and return combined signals."""
    client = create_client(config)
    all_signals: list[RedditSignal] = []

    for sub in TARGET_SUBREDDITS:
        signals = scrape_subreddit(client, sub, limit=limit)
        all_signals.extend(signals)

    return all_signals
