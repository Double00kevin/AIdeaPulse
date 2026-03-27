"""Google Trends scraper using pytrends. Pulls trending searches and rising topics."""

from dataclasses import dataclass

from pytrends.request import TrendReq


@dataclass
class TrendSignal:
    """A raw demand signal from Google Trends."""

    keyword: str
    source: str  # "trending" or "rising"
    value: int  # search volume or growth percentage
    related_topics: list[str]


def create_client() -> TrendReq:
    """Create a pytrends client."""
    return TrendReq(hl="en-US", tz=360)


def scrape_trending(client: TrendReq) -> list[TrendSignal]:
    """Get currently trending searches."""
    trending_df = client.trending_searches(pn="united_states")
    signals: list[TrendSignal] = []

    for keyword in trending_df[0].tolist()[:30]:
        signals.append(
            TrendSignal(
                keyword=keyword,
                source="trending",
                value=0,
                related_topics=[],
            )
        )

    return signals


def scrape_rising_topics(
    client: TrendReq,
    seed_keywords: list[str],
) -> list[TrendSignal]:
    """Get rising related topics for seed keywords relevant to SaaS/startups."""
    signals: list[TrendSignal] = []

    for keyword in seed_keywords:
        client.build_payload([keyword], timeframe="today 3-m")
        related = client.related_topics()

        if keyword in related and "rising" in related[keyword]:
            rising_df = related[keyword]["rising"]
            if rising_df is not None and not rising_df.empty:
                for _, row in rising_df.head(10).iterrows():
                    signals.append(
                        TrendSignal(
                            keyword=str(row.get("topic_title", "")),
                            source="rising",
                            value=int(row.get("value", 0)),
                            related_topics=[keyword],
                        )
                    )

    return signals


SEED_KEYWORDS = [
    "saas tool",
    "startup idea",
    "side project",
    "no code",
    "ai tool",
]


def scrape_all() -> list[TrendSignal]:
    """Scrape all Google Trends signals."""
    client = create_client()
    signals = scrape_trending(client)
    signals.extend(scrape_rising_topics(client, SEED_KEYWORDS))
    return signals
