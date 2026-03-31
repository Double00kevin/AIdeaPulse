"""Claude API analysis module. Takes raw signals and produces structured idea briefs."""

import json
import logging
from dataclasses import dataclass, field

import anthropic

logger = logging.getLogger("aideapulse.analysis")


@dataclass
class IdeaBrief:
    """Structured idea brief produced by Claude API analysis."""

    title: str
    one_liner: str
    problem_statement: str
    target_audience: str
    market_size: dict[str, str]  # TAM, SAM, SOM
    competitors: list[str]
    competitor_count: int
    build_complexity: str  # low, medium, high
    build_timeline: str
    monetization_angle: str
    confidence_score: int  # 0-100
    source_links: list[str] = field(default_factory=list)
    source_type: str = ""  # reddit, google_trends, producthunt, etc.
    # Sprint 5: Rich narrative writeups
    narrative_writeup: str = ""
    product_name: str = ""
    validation_playbook: str = ""
    gtm_strategy: str = ""
    # Sprint 5: Multi-dimensional scores
    scores: dict[str, int] = field(default_factory=dict)
    # Sprint 5: Community signals (populated in main.py from raw signal data)
    community_signals: list[dict] = field(default_factory=list)
    # Sprint 6: Framework analysis (populated by separate analyze_frameworks call)
    frameworks: dict = field(default_factory=dict)


CLASSIFY_PROMPT = """You are a startup signal classifier. Determine if the following signal represents a real startup demand signal — meaning it reveals a problem people would pay to solve, a market gap, or a trend with commercial potential.

Input signal:
{signal}

Respond with ONLY valid JSON (no markdown, no code fences):
{{
  "verdict": "pass" or "skip",
  "reason": "One sentence explaining why (under 100 chars)",
  "category": "one of: pain_point, market_gap, rising_trend, tool_demand, workflow_friction, other"
}}

Guidelines:
- PASS signals that reveal unmet needs, complaints about existing tools, requests for solutions, emerging markets, or high-engagement discussions about building something
- SKIP generic news, self-promotion, tutorials without pain points, memes, already-solved problems, or signals too vague to extract a startup idea from
- Be selective — only ~40-60% of signals should pass"""


ANALYSIS_PROMPT = """You are an expert startup analyst. Analyze the following demand signal and produce a structured startup idea brief with a full business case.

Input signal:
{signal}

Respond with ONLY valid JSON (no markdown, no code fences) matching this schema:
{{
  "title": "Short idea title (under 60 chars)",
  "product_name": "A creative, memorable product name for this idea",
  "one_liner": "One sentence pitch",
  "problem_statement": "What specific problem does this solve?",
  "target_audience": "Who specifically is this for?",
  "market_size": {{
    "tam": "Total addressable market (dollar amount)",
    "sam": "Serviceable addressable market (dollar amount)",
    "som": "Serviceable obtainable market (dollar amount)"
  }},
  "competitors": ["Specific competitor 1", "Specific competitor 2"],
  "build_complexity": "low|medium|high",
  "build_timeline": "Estimated time to MVP (e.g., '2 weekends', '1 month')",
  "monetization_angle": "How to make money (be specific about pricing)",
  "narrative_writeup": "A 3-4 paragraph business case. Paragraph 1: the problem and why it exists now. Paragraph 2: what the product does and how it works. Paragraph 3: how to validate it (specific steps, first 10 customers). Paragraph 4: monetization and growth path. Write in direct, practical language. Name the product by the product_name you chose.",
  "validation_playbook": "3-5 specific validation steps. Each step should be concrete and actionable (e.g., 'Post in r/freelance asking about this pain point', 'Build a landing page and run $50 in Google Ads', 'Interview 10 target users from LinkedIn')",
  "gtm_strategy": "Go-to-market strategy: which channels to use first, pricing strategy, partnerships to pursue, and how to get the first 100 paying customers. Be specific about communities, platforms, and price points.",
  "scores": {{
    "opportunity": 0-100,
    "pain_level": 0-100,
    "builder_confidence": 0-100,
    "timing": 0-100
  }}
}}

Scoring rubrics (each 0-100):
- opportunity: Market size clarity + competitive gap. Large clear market with few funded competitors = high.
- pain_level: Signal engagement strength + problem urgency. High upvotes/comments on pain posts = high.
- builder_confidence: Technical feasibility + timeline realism. Simple stack, clear MVP scope = high.
- timing: Trend velocity + market readiness. Rising search volume, regulatory changes, new tech enablers = high.

The overall confidence_score will be computed as: opportunity*0.30 + pain_level*0.25 + builder_confidence*0.25 + timing*0.20.

Be specific with market sizes (use dollar amounts). Be honest about scores.
If the signal is weak or not really a startup idea, give low scores (under 30)."""


FRAMEWORKS_PROMPT = """You are an expert startup analyst. Evaluate this startup idea using 4 business frameworks. Be specific and practical — write for a developer who wants to know if this is worth building.

Idea: {title}
One-liner: {one_liner}
Problem: {problem_statement}
Target audience: {target_audience}
Build complexity: {build_complexity}
Competitors: {competitors}
Monetization: {monetization_angle}

Respond with ONLY valid JSON (no markdown, no code fences):
[
  {{
    "label": "Is this worth building?",
    "framework": "Value Equation",
    "score": 0-10,
    "explanation": "2-3 sentences. Dream outcome for the user vs effort/sacrifice to build and maintain. Is the juice worth the squeeze?"
  }},
  {{
    "label": "Who would pay and why?",
    "framework": "ACP",
    "score": 0-10,
    "explanation": "2-3 sentences. Audience (who specifically), Channel (where to reach them), Product fit (does it match their workflow?)."
  }},
  {{
    "label": "How does this stack up?",
    "framework": "Value Matrix",
    "score": 0-10,
    "explanation": "2-3 sentences. Differentiation vs competitors and resonance with target users. Where does this sit?"
  }},
  {{
    "label": "Where's the money?",
    "framework": "Value Ladder",
    "score": 0-10,
    "explanation": "2-3 sentences. Monetization path from free to paid. Specific pricing tiers and what unlocks at each level."
  }}
]

Score rubric (0-10): 8-10 = strong signal, clear path. 5-7 = mixed, needs validation. 1-4 = weak, significant concerns."""


def analyze_frameworks(
    client: anthropic.Anthropic,
    brief: "IdeaBrief",
) -> list[dict]:
    """Stage 3: Generate framework analysis for an idea using Sonnet.

    Returns a list of 4 framework dicts, or empty list on failure.
    """
    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1500,
            messages=[
                {
                    "role": "user",
                    "content": FRAMEWORKS_PROMPT.format(
                        title=brief.title,
                        one_liner=brief.one_liner,
                        problem_statement=brief.problem_statement,
                        target_audience=brief.target_audience,
                        build_complexity=brief.build_complexity,
                        competitors=", ".join(brief.competitors[:5]),
                        monetization_angle=brief.monetization_angle,
                    ),
                }
            ],
        )

        raw_text = message.content[0].text.strip()

        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3].strip()

        data = json.loads(raw_text)

        if not isinstance(data, list):
            logger.warning("Frameworks response is not a list: %s", type(data))
            return []

        # Validate and clamp scores
        validated = []
        for item in data:
            if not isinstance(item, dict):
                continue
            score = item.get("score", 0)
            if isinstance(score, (int, float)):
                score = max(0, min(10, round(score)))
            else:
                score = 0
            validated.append({
                "label": str(item.get("label", "")),
                "framework": str(item.get("framework", "")),
                "score": score,
                "explanation": str(item.get("explanation", "")),
            })

        return validated

    except json.JSONDecodeError as e:
        logger.warning("Failed to parse frameworks response as JSON: %s", e)
        return []
    except (KeyError, TypeError) as e:
        logger.warning("Missing required field in frameworks response: %s", e)
        return []
    except anthropic.APIError as e:
        logger.error("Claude API error during frameworks analysis: %s", e)
        return []


@dataclass
class ClassifyResult:
    """Result of stage-1 signal classification."""

    verdict: str  # "pass" or "skip"
    reason: str
    category: str


def create_client(api_key: str) -> anthropic.Anthropic:
    """Create an Anthropic client."""
    return anthropic.Anthropic(api_key=api_key)


def classify_signal(
    client: anthropic.Anthropic,
    signal_text: str,
) -> ClassifyResult:
    """Stage 1: Classify a signal as pass/skip using Haiku (fast + cheap)."""
    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[
                {
                    "role": "user",
                    "content": CLASSIFY_PROMPT.format(signal=signal_text),
                }
            ],
        )

        raw_text = message.content[0].text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3].strip()

        data = json.loads(raw_text)
        return ClassifyResult(
            verdict=data.get("verdict", "skip"),
            reason=data.get("reason", ""),
            category=data.get("category", "other"),
        )

    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.warning("Failed to parse classify response: %s", e)
        return ClassifyResult(verdict="pass", reason="classify failed, defaulting to pass", category="other")
    except anthropic.APIError as e:
        logger.error("Claude API error during classify: %s", e)
        return ClassifyResult(verdict="pass", reason="API error, defaulting to pass", category="other")


def _compute_confidence(scores: dict[str, int]) -> int:
    """Compute weighted composite confidence score from sub-scores."""
    opp = max(0, min(100, scores.get("opportunity", 0)))
    pain = max(0, min(100, scores.get("pain_level", 0)))
    builder = max(0, min(100, scores.get("builder_confidence", 0)))
    timing = max(0, min(100, scores.get("timing", 0)))
    return round(opp * 0.30 + pain * 0.25 + builder * 0.25 + timing * 0.20)


def analyze_signal(
    client: anthropic.Anthropic,
    signal_text: str,
    source_links: list[str],
    signal_type: str,
) -> IdeaBrief | None:
    """Analyze a single raw signal and return a structured idea brief."""
    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=3000,
            messages=[
                {
                    "role": "user",
                    "content": ANALYSIS_PROMPT.format(signal=signal_text),
                }
            ],
        )

        raw_text = message.content[0].text.strip()

        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3].strip()

        data = json.loads(raw_text)

        competitors = data.get("competitors", [])

        # Parse multi-dimensional scores
        raw_scores = data.get("scores", {})
        scores = {
            "opportunity": max(0, min(100, int(raw_scores.get("opportunity", 0)))),
            "pain_level": max(0, min(100, int(raw_scores.get("pain_level", 0)))),
            "builder_confidence": max(0, min(100, int(raw_scores.get("builder_confidence", 0)))),
            "timing": max(0, min(100, int(raw_scores.get("timing", 0)))),
        }

        # Compute composite confidence from sub-scores
        confidence = _compute_confidence(scores)

        return IdeaBrief(
            title=data["title"][:100],
            one_liner=data["one_liner"][:200],
            problem_statement=data.get("problem_statement", ""),
            target_audience=data.get("target_audience", ""),
            market_size=data.get("market_size", {"tam": "", "sam": "", "som": ""}),
            competitors=competitors,
            competitor_count=len(competitors),
            build_complexity=data.get("build_complexity", "medium"),
            build_timeline=data.get("build_timeline", ""),
            monetization_angle=data.get("monetization_angle", ""),
            confidence_score=confidence,
            source_links=source_links,
            source_type=signal_type,
            narrative_writeup=data.get("narrative_writeup", ""),
            product_name=data.get("product_name", ""),
            validation_playbook=data.get("validation_playbook", ""),
            gtm_strategy=data.get("gtm_strategy", ""),
            scores=scores,
        )

    except json.JSONDecodeError as e:
        logger.warning("Failed to parse Claude response as JSON: %s", e)
        return None
    except (KeyError, TypeError) as e:
        logger.warning("Missing required field in Claude response: %s", e)
        return None
    except anthropic.APIError as e:
        logger.error("Claude API error: %s", e)
        return None
