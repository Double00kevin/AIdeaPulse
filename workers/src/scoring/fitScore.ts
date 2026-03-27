export interface UserProfile {
  skills: string[];
  budget_range: "bootstrapped" | "low" | "medium" | "high";
  niches: string[];
  experience_level: "beginner" | "intermediate" | "advanced" | "expert";
}

export interface IdeaForScoring {
  title: string;
  one_liner: string;
  problem_statement: string | null;
  target_audience: string | null;
  build_complexity: "low" | "medium" | "high";
  monetization_angle: string | null;
  source_type: string;
  competitors: string[];
}

export interface FitResult {
  fit_score: number; // 0-100
  fit_reason: string; // one sentence
}

// --- Sub-score helpers ---

function scoreSkillMatch(profile: UserProfile, idea: IdeaForScoring): { score: number; matched: string[] } {
  if (profile.skills.length === 0) return { score: 0, matched: [] };

  const corpus = [
    idea.target_audience,
    idea.one_liner,
    idea.problem_statement,
    idea.monetization_angle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const matched = profile.skills.filter((skill) => corpus.includes(skill.toLowerCase()));
  const count = matched.length;

  let score: number;
  if (count === 0) score = 0;
  else if (count === 1) score = 40;
  else if (count === 2) score = 70;
  else score = 100;

  return { score, matched };
}

const SOURCE_NICHE_MAP: Record<string, string[]> = {
  github_trending: ["developer_tools", "open_source", "software", "devops"],
  hackernews: ["tech", "startup", "developer_tools", "saas"],
  reddit: ["consumer", "community", "niche"],
  producthunt: ["saas", "startup", "productivity", "developer_tools"],
  devto: ["developer_tools", "software", "web_development"],
  lobsters: ["developer_tools", "systems", "programming"],
  google_trends: ["consumer", "trending", "mainstream"],
  newsapi: ["media", "news", "trending"],
};

function scoreNicheMatch(profile: UserProfile, idea: IdeaForScoring): { score: number; matched: boolean } {
  if (profile.niches.length === 0) return { score: 0, matched: false };

  const sourceNiches = SOURCE_NICHE_MAP[idea.source_type] ?? [];
  const lowerNiches = profile.niches.map((n) => n.toLowerCase());

  // Direct niche-to-source match
  const sourceMatch = lowerNiches.some((niche) =>
    sourceNiches.some((sn) => sn.includes(niche) || niche.includes(sn)),
  );

  // Keyword match in title + one_liner
  const ideaText = `${idea.title} ${idea.one_liner}`.toLowerCase();
  const keywordMatch = lowerNiches.some((niche) => ideaText.includes(niche));

  if (sourceMatch && keywordMatch) return { score: 100, matched: true };
  if (sourceMatch || keywordMatch) return { score: 50, matched: true };
  return { score: 0, matched: false };
}

const BUDGET_SCORES: Record<string, Record<string, number>> = {
  low: { bootstrapped: 100, low: 100, medium: 100, high: 100 },
  medium: { bootstrapped: 30, low: 70, medium: 100, high: 100 },
  high: { bootstrapped: 10, low: 40, medium: 80, high: 100 },
};

function scoreBudgetMatch(profile: UserProfile, idea: IdeaForScoring): number {
  return BUDGET_SCORES[idea.build_complexity]?.[profile.budget_range] ?? 50;
}

const COMPLEXITY_SCORES: Record<string, Record<string, number>> = {
  beginner: { low: 100, medium: 40, high: 10 },
  intermediate: { low: 70, medium: 100, high: 50 },
  advanced: { low: 40, medium: 80, high: 100 },
  expert: { low: 30, medium: 70, high: 100 },
};

function scoreComplexityFit(profile: UserProfile, idea: IdeaForScoring): number {
  return COMPLEXITY_SCORES[profile.experience_level]?.[idea.build_complexity] ?? 50;
}

// --- Reason generation ---

function generateReason(
  skillMatched: string[],
  nicheMatched: boolean,
  budgetScore: number,
  complexityScore: number,
  idea: IdeaForScoring,
  profile: UserProfile,
): string {
  const factors: string[] = [];

  if (skillMatched.length > 0) {
    const skillList = skillMatched.slice(0, 2).join(" and ");
    factors.push(`Matches your ${skillList} skill${skillMatched.length > 1 ? "s" : ""}`);
  }

  if (nicheMatched) {
    factors.push("Aligns with your niche interests");
  }

  if (budgetScore >= 80) {
    factors.push(`${idea.build_complexity} complexity fits your budget`);
  } else if (budgetScore <= 30) {
    factors.push(`${idea.build_complexity} complexity may exceed your budget`);
  }

  if (complexityScore >= 80) {
    factors.push(`Good match for your ${profile.experience_level} experience level`);
  } else if (complexityScore <= 30) {
    factors.push(`${idea.build_complexity} complexity may be challenging for your experience level`);
  }

  if (factors.length === 0) {
    return "Low overlap with your profile.";
  }

  return factors.slice(0, 2).join(". ") + ".";
}

// --- Main scoring function ---

export function calculateFitScore(profile: UserProfile, idea: IdeaForScoring): FitResult {
  const { score: skillScore, matched: skillMatched } = scoreSkillMatch(profile, idea);
  const { score: nicheScore, matched: nicheMatched } = scoreNicheMatch(profile, idea);
  const budgetScore = scoreBudgetMatch(profile, idea);
  const complexityScore = scoreComplexityFit(profile, idea);

  const fit_score = Math.round(
    skillScore * 0.35 + nicheScore * 0.25 + budgetScore * 0.2 + complexityScore * 0.2,
  );

  const fit_reason = generateReason(
    skillMatched,
    nicheMatched,
    budgetScore,
    complexityScore,
    idea,
    profile,
  );

  return { fit_score, fit_reason };
}
