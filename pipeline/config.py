"""Configuration loaded from environment variables."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class RedditConfig:
    client_id: str
    client_secret: str
    user_agent: str


@dataclass(frozen=True)
class CloudflareConfig:
    api_token: str
    account_id: str
    d1_database_id: str
    ingest_webhook_url: str
    ingest_webhook_secret: str


@dataclass(frozen=True)
class Config:
    anthropic_api_key: str
    cloudflare: CloudflareConfig
    reddit: RedditConfig | None  # None if no Reddit API creds
    producthunt_access_token: str
    newsapi_key: str


def load_config() -> Config:
    """Load configuration from environment variables. Raises ValueError if required vars are missing."""

    def require(key: str) -> str:
        value = os.environ.get(key)
        if not value:
            raise ValueError(f"Missing required environment variable: {key}")
        return value

    # Reddit API is optional — pipeline uses .json feeds as fallback
    reddit_id = os.environ.get("REDDIT_CLIENT_ID")
    reddit_secret = os.environ.get("REDDIT_CLIENT_SECRET")
    reddit_config = None
    if reddit_id and reddit_secret:
        reddit_config = RedditConfig(
            client_id=reddit_id,
            client_secret=reddit_secret,
            user_agent=os.environ.get("REDDIT_USER_AGENT", "IdeaVault/0.1"),
        )

    return Config(
        anthropic_api_key=require("ANTHROPIC_API_KEY"),
        cloudflare=CloudflareConfig(
            api_token=os.environ.get("CF_API_TOKEN", ""),
            account_id=os.environ.get("CF_ACCOUNT_ID", ""),
            d1_database_id=os.environ.get("CF_D1_DATABASE_ID", ""),
            ingest_webhook_url=require("INGEST_WEBHOOK_URL"),
            ingest_webhook_secret=require("INGEST_WEBHOOK_SECRET"),
        ),
        reddit=reddit_config,
        producthunt_access_token=os.environ.get("PRODUCTHUNT_ACCESS_TOKEN", ""),
        newsapi_key=os.environ.get("NEWSAPI_KEY", ""),
    )
