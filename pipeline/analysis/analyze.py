"""Claude API analysis module. Takes raw signals and produces structured idea briefs."""

from dataclasses import dataclass, field

import anthropic


@dataclass
class IdeaBrief:
    """Structured idea brief produced by Claude API analysis."""

    title: str
    one_liner: str
    problem_statement: str
    target_audience: str
    market_size: dict[str, str]  # TAM, SAM, SOM
    competitors: list[str]
    build_complexity: str  # low, medium, high
    build_timeline: str
    monetization_angle: str
    confidence_score: int  # 0-100
    source_links: list[str] = field(default_factory=list)
    raw_signal_type: str = ""  # reddit, google_trends, producthunt


ANALYSIS_PROMPT = """You are an expert startup analyst. Analyze the following demand signal(s) and produce a structured startup idea brief.

Input signals:
{signals}

Respond with valid JSON matching this schema:
{{
  "title": "Short idea title",
  "one_liner": "One sentence pitch",
  "problem_statement": "What problem does this solve?",
  "target_audience": "Who is this for?",
  "market_size": {{
    "tam": "Total addressable market estimate",
    "sam": "Serviceable addressable market estimate",
    "som": "Serviceable obtainable market estimate"
  }},
  "competitors": ["Competitor 1", "Competitor 2"],
  "build_complexity": "low|medium|high",
  "build_timeline": "Estimated time to MVP",
  "monetization_angle": "How to make money",
  "confidence_score": 0-100
}}

Be specific with market sizes (use dollar amounts). Be honest about confidence — low confidence is fine if the signal is weak."""


def create_client(api_key: str) -> anthropic.Anthropic:
    """Create an Anthropic client."""
    return anthropic.Anthropic(api_key=api_key)


def analyze_signals(
    client: anthropic.Anthropic,
    signals_text: str,
    source_links: list[str],
    signal_type: str,
) -> IdeaBrief | None:
    """Analyze raw signals and return a structured idea brief."""
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[
            {
                "role": "user",
                "content": ANALYSIS_PROMPT.format(signals=signals_text),
            }
        ],
    )

    # TODO: Parse JSON response into IdeaBrief
    # TODO: Handle malformed responses gracefully
    # This is a stub — full implementation in Sprint 2

    _ = message  # suppress unused warning
    return None
