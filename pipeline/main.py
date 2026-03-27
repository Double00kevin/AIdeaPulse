"""Main pipeline entrypoint. Run via systemd timer or manually."""

import logging

from pipeline.config import load_config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ideavault.pipeline")


def run() -> None:
    """Run the full ingestion pipeline: scrape -> analyze -> push."""
    logger.info("Starting IdeaVault ingestion pipeline")

    config = load_config()
    logger.info("Config loaded successfully")

    # Step 1: Scrape signals from all sources
    # TODO: Implement in Sprint 2
    logger.info("Scraping signals...")

    # Step 2: Analyze signals with Claude API
    # TODO: Implement in Sprint 2
    logger.info("Analyzing signals...")

    # Step 3: Push analyzed ideas to Cloudflare D1
    # TODO: Implement in Sprint 2
    logger.info("Pushing ideas to Cloudflare...")

    logger.info("Pipeline complete")


if __name__ == "__main__":
    run()
