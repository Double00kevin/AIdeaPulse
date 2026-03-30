"""PyPI and npm package trend scraper. Tracks emerging packages by download velocity."""

import logging
import xml.etree.ElementTree as ET
from dataclasses import dataclass

import httpx

logger = logging.getLogger("aideapulse.scrapers.package_trends")

PYPI_NEW_PACKAGES_RSS = "https://pypi.org/rss/packages.xml"
PYPI_UPDATES_RSS = "https://pypi.org/rss/updates.xml"
PYPISTATS_API = "https://pypistats.org/api"
NPM_SEARCH_URL = "https://registry.npmjs.org/-/v1/search"

# Keywords that indicate demand-signal-relevant packages
PYPI_RELEVANCE_KEYWORDS = {
    "ai", "agent", "llm", "automation", "workflow", "api", "sdk",
    "developer", "tool", "scraper", "pipeline", "no-code", "saas",
    "auth", "headless", "framework", "orchestrat",
}

NPM_SEARCH_TERMS = [
    "ai agent",
    "llm",
    "developer tools",
    "workflow automation",
    "headless",
    "auth sdk",
]


@dataclass
class PackageTrendSignal:
    """A raw demand signal from package registries."""

    registry: str  # "pypi" or "npm"
    package_name: str
    description: str
    downloads_recent: int  # last 7 days (PyPI) or weekly (npm)
    version: str
    url: str
    keywords: list[str]


def _scrape_npm(
    client: httpx.Client,
    terms: list[str],
    per_term: int = 10,
) -> list[PackageTrendSignal]:
    """Search npm registry for trending packages by keyword."""
    signals: list[PackageTrendSignal] = []

    for term in terms:
        try:
            resp = client.get(
                NPM_SEARCH_URL,
                params={
                    "text": term,
                    "size": per_term,
                    "popularity": 0.5,
                    "quality": 0.3,
                    "maintenance": 0.2,
                },
                timeout=15,
            )
            resp.raise_for_status()
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.error("npm search failed for '%s': %s", term, e)
            continue

        data = resp.json()
        for obj in data.get("objects", []):
            pkg = obj.get("package", {})
            score = obj.get("score", {}).get("detail", {})
            popularity = score.get("popularity", 0)

            signals.append(
                PackageTrendSignal(
                    registry="npm",
                    package_name=pkg.get("name", ""),
                    description=pkg.get("description", "")[:500],
                    downloads_recent=int(popularity * 10000),  # normalized score
                    version=pkg.get("version", ""),
                    url=f"https://www.npmjs.com/package/{pkg.get('name', '')}",
                    keywords=pkg.get("keywords", []) or [],
                )
            )

    logger.info("Scraped %d packages from npm", len(signals))
    return signals


def _is_relevant(title: str, description: str) -> bool:
    """Check if a package name/description matches demand-signal keywords."""
    text = f"{title} {description}".lower()
    return any(kw in text for kw in PYPI_RELEVANCE_KEYWORDS)


def _get_pypi_downloads(client: httpx.Client, package_name: str) -> int:
    """Fetch recent download count for a PyPI package."""
    try:
        resp = client.get(
            f"{PYPISTATS_API}/packages/{package_name}/recent",
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", {}).get("last_week", 0)
    except (httpx.HTTPStatusError, httpx.RequestError):
        return 0


def _scrape_pypi_rss(
    client: httpx.Client,
    max_packages: int = 30,
) -> list[PackageTrendSignal]:
    """Discover new/updated PyPI packages via RSS feeds, then fetch stats."""
    signals: list[PackageTrendSignal] = []
    seen_names: set[str] = set()

    for feed_url in (PYPI_NEW_PACKAGES_RSS, PYPI_UPDATES_RSS):
        try:
            resp = client.get(feed_url, timeout=15)
            resp.raise_for_status()
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.error("PyPI RSS fetch failed: %s", e)
            continue

        try:
            root = ET.fromstring(resp.text)
        except ET.ParseError as e:
            logger.error("PyPI RSS parse failed: %s", e)
            continue

        for item in root.iter("item"):
            title_el = item.find("title")
            link_el = item.find("link")
            desc_el = item.find("description")
            if title_el is None or link_el is None:
                continue

            # Extract package name from link (most reliable)
            # Links: https://pypi.org/project/NAME/ or https://pypi.org/project/NAME/VERSION/
            link_text = link_el.text or ""
            link_parts = link_text.rstrip("/").split("/")
            # New packages title: "NAME added to PyPI"
            # Updates title: "NAME VERSION"
            title_text = title_el.text or ""
            if " added to PyPI" in title_text:
                name = title_text.replace(" added to PyPI", "").strip()
                version = ""
            else:
                parts = title_text.rsplit(" ", 1)
                name = parts[0].strip()
                version = parts[1].strip() if len(parts) > 1 else ""

            # Prefer name from link if possible
            if len(link_parts) >= 5 and link_parts[3] == "project":
                name = link_parts[4]

            description = (desc_el.text or "")[:500]

            if name in seen_names:
                continue
            if not _is_relevant(name, description):
                continue

            seen_names.add(name)
            downloads = _get_pypi_downloads(client, name)

            # Fetch keywords from PyPI JSON API
            keywords: list[str] = []
            try:
                pkg_resp = client.get(
                    f"https://pypi.org/pypi/{name}/json",
                    timeout=10,
                )
                if pkg_resp.status_code == 200:
                    info = pkg_resp.json().get("info", {})
                    kw_str = info.get("keywords", "")
                    if kw_str:
                        keywords = [k.strip() for k in kw_str.split(",")][:10]
                    # Use summary if RSS description was empty
                    if not description:
                        description = info.get("summary", "")[:500]
            except (httpx.HTTPStatusError, httpx.RequestError):
                pass

            signals.append(
                PackageTrendSignal(
                    registry="pypi",
                    package_name=name,
                    description=description,
                    downloads_recent=downloads,
                    version=version,
                    url=link_el.text or f"https://pypi.org/project/{name}/",
                    keywords=keywords,
                )
            )

            if len(signals) >= max_packages:
                break

    logger.info("Scraped %d packages from PyPI RSS", len(signals))
    return signals


def scrape_all() -> list[PackageTrendSignal]:
    """Scrape trending packages from PyPI and npm."""
    all_signals: list[PackageTrendSignal] = []

    with httpx.Client(
        headers={"User-Agent": "AIdeaPulse/0.1 (demand signal research)"},
    ) as client:
        npm_signals = _scrape_npm(client, NPM_SEARCH_TERMS)
        pypi_signals = _scrape_pypi_rss(client)
        all_signals.extend(npm_signals)
        all_signals.extend(pypi_signals)

    # Deduplicate by (registry, package_name)
    seen: set[tuple[str, str]] = set()
    deduped: list[PackageTrendSignal] = []
    for signal in all_signals:
        key = (signal.registry, signal.package_name)
        if key not in seen:
            seen.add(key)
            deduped.append(signal)

    logger.info("Total package trend signals: %d (deduplicated)", len(deduped))
    return deduped
