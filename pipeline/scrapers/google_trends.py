"""Google Trends scraper using pytrends (optional enrichment, may break)."""

import logging
from dataclasses import dataclass

logger = logging.getLogger("aideapulse.scrapers.google_trends")


@dataclass
class TrendSignal:
    """A raw demand signal from Google Trends."""

    keyword: str
    source: str  # "trending" or "rising"
    value: int  # search volume or growth percentage
    related_topics: list[str]


SEED_KEYWORDS = [
    "saas tool",
    "startup idea",
    "side project",
    "no code",
    "ai tool",
]


def scrape_all() -> list[TrendSignal]:
    """Scrape Google Trends signals. Returns empty list if pytrends fails."""
    try:
        from pytrends.request import TrendReq

        client = TrendReq(hl="en-US", tz=360)
        signals: list[TrendSignal] = []

        # Trending searches
        try:
            trending_df = client.trending_searches(pn="united_states")
            for keyword in trending_df[0].tolist()[:20]:
                signals.append(
                    TrendSignal(
                        keyword=keyword,
                        source="trending",
                        value=0,
                        related_topics=[],
                    )
                )
        except Exception as e:
            logger.warning("Trending searches failed: %s", e)

        # Rising topics for seed keywords
        for keyword in SEED_KEYWORDS:
            try:
                client.build_payload([keyword], timeframe="today 3-m")
                related = client.related_topics()

                if keyword in related and "rising" in related[keyword]:
                    rising_df = related[keyword]["rising"]
                    if rising_df is not None and not rising_df.empty:
                        for _, row in rising_df.head(5).iterrows():
                            signals.append(
                                TrendSignal(
                                    keyword=str(row.get("topic_title", "")),
                                    source="rising",
                                    value=int(row.get("value", 0)),
                                    related_topics=[keyword],
                                )
                            )
            except Exception as e:
                logger.warning("Rising topics for '%s' failed: %s", keyword, e)

        logger.info("Scraped %d Google Trends signals", len(signals))
        return signals

    except ImportError:
        logger.warning("pytrends not installed, skipping Google Trends")
        return []
    except Exception as e:
        logger.error("Google Trends scraper failed entirely: %s", e)
        return []
