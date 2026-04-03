"""One-time backfill: generate framework analysis for existing ideas that don't have it.

Usage:
    cd ~/AIdeaPulse/pipeline
    source .venv/bin/activate
    python -m pipeline.backfill_frameworks

Reads ideas from D1 via wrangler CLI, runs analyze_frameworks() on each,
updates frameworks_json in D1. Estimated cost: ~$0.01 per idea (~$2 for 201 ideas).
"""

import json
import logging
import os
import subprocess
import sys
import time

from dotenv import load_dotenv

from pipeline.analysis.analyze import IdeaBrief, analyze_frameworks, create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger("backfill")

WORKERS_DIR = os.path.expanduser("~/AIdeaPulse/workers")


def d1_query(sql: str) -> list[dict]:
    """Run a D1 query via wrangler CLI and return results."""
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "ideavault", "--remote", "--command", sql, "--json"],
        capture_output=True, text=True, cwd=WORKERS_DIR, timeout=30,
    )
    if result.returncode != 0:
        logger.error("D1 query failed: %s", result.stderr)
        return []

    try:
        data = json.loads(result.stdout)
        if isinstance(data, list) and len(data) > 0:
            return data[0].get("results", [])
    except json.JSONDecodeError:
        logger.error("Failed to parse D1 response")
    return []


def d1_execute(sql: str) -> bool:
    """Run a D1 write command via wrangler CLI."""
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "ideavault", "--remote", "--command", sql],
        capture_output=True, text=True, cwd=WORKERS_DIR, timeout=30,
    )
    return result.returncode == 0


def main():
    load_dotenv()
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.error("ANTHROPIC_API_KEY not set in .env")
        sys.exit(1)

    cf_aig_token = os.getenv("CF_AIG_TOKEN")
    if not cf_aig_token:
        logger.error("CF_AIG_TOKEN not set in .env")
        sys.exit(1)

    client = create_client(api_key, cf_aig_token)

    # Fetch ideas that need frameworks
    logger.info("Fetching ideas without frameworks from D1...")
    ideas = d1_query(
        "SELECT id, title, one_liner, problem_statement, target_audience, "
        "build_complexity, competitors_json, monetization_angle, frameworks_json "
        "FROM ideas WHERE frameworks_json IS NULL OR frameworks_json = '{}' OR frameworks_json = '[]'"
    )

    if not ideas:
        logger.info("No ideas need framework backfill. Done!")
        return

    logger.info("Found %d ideas to backfill", len(ideas))
    success = 0
    failed = 0

    for i, idea in enumerate(ideas):
        idea_id = idea["id"]
        title = idea["title"]
        logger.info("[%d/%d] Analyzing frameworks for: %s", i + 1, len(ideas), title)

        # Build a minimal IdeaBrief for the frameworks prompt
        brief = IdeaBrief(
            title=title,
            one_liner=idea.get("one_liner", ""),
            problem_statement=idea.get("problem_statement", ""),
            target_audience=idea.get("target_audience", ""),
            market_size={"tam": "", "sam": "", "som": ""},
            competitors=json.loads(idea.get("competitors_json", "[]")),
            competitor_count=0,
            build_complexity=idea.get("build_complexity", "medium"),
            build_timeline="",
            monetization_angle=idea.get("monetization_angle", ""),
            confidence_score=0,
        )

        frameworks = analyze_frameworks(client, brief)

        if not frameworks:
            logger.warning("  Failed to generate frameworks for: %s", title)
            failed += 1
            continue

        # Update D1
        frameworks_json = json.dumps(frameworks).replace("'", "''")
        ok = d1_execute(
            f"UPDATE ideas SET frameworks_json = '{frameworks_json}' WHERE id = '{idea_id}'"
        )

        if ok:
            logger.info("  Updated %s with %d frameworks (scores: %s)",
                        title[:40],
                        len(frameworks),
                        ", ".join(f"{f['score']}/10" for f in frameworks))
            success += 1
        else:
            logger.error("  D1 update failed for: %s", title)
            failed += 1

        # Small delay to avoid API rate limiting
        time.sleep(0.5)

    logger.info("Backfill complete: %d success, %d failed out of %d total",
                success, failed, len(ideas))


if __name__ == "__main__":
    main()
