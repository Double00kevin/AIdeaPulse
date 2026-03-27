import { Hono } from "hono";
import type { Env } from "../index";

const ogHandler = new Hono<{ Bindings: Env }>();

const COMPLEXITY_COLORS: Record<string, string> = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#dc2626",
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function generateOgSvg(idea: {
  title: string;
  one_liner: string;
  confidence_score: number;
  build_complexity: string;
  competitor_count: number;
}): string {
  const complexityColor = COMPLEXITY_COLORS[idea.build_complexity] ?? "#d97706";
  const title = escapeXml(truncate(idea.title, 50));
  const oneLiner = escapeXml(truncate(idea.one_liner, 90));
  const complexity = idea.build_complexity.charAt(0).toUpperCase() + idea.build_complexity.slice(1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&amp;display=swap');
    </style>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#fafafa"/>

  <!-- Top border accent -->
  <rect width="1200" height="4" fill="#2563eb"/>

  <!-- Brand -->
  <text x="60" y="70" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#1a1a1a">AIdeaPulse</text>
  <text x="185" y="70" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#666666">AI-analyzed startup ideas</text>

  <!-- Confidence score (big number) -->
  <text x="1020" y="130" font-family="JetBrains Mono, monospace" font-size="96" font-weight="700" fill="#1a1a1a" text-anchor="middle">${idea.confidence_score}</text>
  <text x="1020" y="160" font-family="JetBrains Mono, monospace" font-size="14" fill="#666666" text-anchor="middle">CONFIDENCE</text>

  <!-- Complexity badge -->
  <circle cx="75" cy="140" r="8" fill="${complexityColor}"/>
  <text x="92" y="145" font-family="JetBrains Mono, monospace" font-size="14" fill="#666666" text-transform="uppercase">${complexity} complexity</text>

  <!-- Title -->
  <text x="60" y="220" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="700" fill="#1a1a1a">${title}</text>

  <!-- One-liner -->
  <text x="60" y="280" font-family="system-ui, -apple-system, sans-serif" font-size="22" fill="#666666">${oneLiner}</text>

  <!-- Stats row -->
  <line x1="60" y1="340" x2="900" y2="340" stroke="#e5e5e5" stroke-width="1"/>

  <text x="60" y="380" font-family="JetBrains Mono, monospace" font-size="16" fill="#1a1a1a">${idea.competitor_count} competitor${idea.competitor_count !== 1 ? "s" : ""}</text>

  <!-- Footer -->
  <rect y="570" width="1200" height="60" fill="#ffffff"/>
  <line x1="0" y1="570" x2="1200" y2="570" stroke="#e5e5e5" stroke-width="1"/>
  <text x="60" y="605" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="#999999">aideapulse.com</text>
</svg>`;
}

/** GET /api/og/:id — Generate OG image for an idea. */
ogHandler.get("/:id", async (c) => {
  const id = c.req.param("id");

  const idea = await c.env.DB.prepare(
    "SELECT title, one_liner, confidence_score, build_complexity, competitor_count FROM ideas WHERE id = ?",
  )
    .bind(id)
    .first<{
      title: string;
      one_liner: string;
      confidence_score: number;
      build_complexity: string;
      competitor_count: number;
    }>();

  if (!idea) {
    return c.json({ error: "Idea not found" }, 404);
  }

  const svg = generateOgSvg(idea);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400", // Cache 24h
    },
  });
});

export { ogHandler };
