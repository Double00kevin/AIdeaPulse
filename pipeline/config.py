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
    reddit: RedditConfig
    cloudflare: CloudflareConfig
    producthunt_access_token: str


def load_config() -> Config:
    """Load configuration from environment variables. Raises ValueError if required vars are missing."""

    def require(key: str) -> str:
        value = os.environ.get(key)
        if not value:
            raise ValueError(f"Missing required environment variable: {key}")
        return value

    return Config(
        anthropic_api_key=require("ANTHROPIC_API_KEY"),
        reddit=RedditConfig(
            client_id=require("REDDIT_CLIENT_ID"),
            client_secret=require("REDDIT_CLIENT_SECRET"),
            user_agent=os.environ.get("REDDIT_USER_AGENT", "IdeaVault/0.1"),
        ),
        cloudflare=CloudflareConfig(
            api_token=require("CF_API_TOKEN"),
            account_id=require("CF_ACCOUNT_ID"),
            d1_database_id=require("CF_D1_DATABASE_ID"),
            ingest_webhook_url=require("INGEST_WEBHOOK_URL"),
            ingest_webhook_secret=require("INGEST_WEBHOOK_SECRET"),
        ),
        producthunt_access_token=os.environ.get("PRODUCTHUNT_ACCESS_TOKEN", ""),
    )
