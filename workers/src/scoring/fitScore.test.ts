import { describe, it, expect } from "vitest";
import { calculateFitScore, UserProfile, IdeaForScoring } from "./fitScore";

const baseIdea: IdeaForScoring = {
  title: "AI-Powered Newsletter Analytics Dashboard",
  one_liner: "Revenue tracking and churn prediction for newsletter creators using React and ML",
  problem_statement: "Newsletter creators lack visibility into per-subscriber economics",
  target_audience: "Independent newsletter creators who use React and Python for automation",
  build_complexity: "low",
  monetization_angle: "Freemium SaaS with API access for developers",
  source_type: "producthunt",
  competitors: ["Substack Analytics", "Beehiiv Insights"],
};

describe("calculateFitScore", () => {
  it("scores > 80 for a perfect match profile", () => {
    const profile: UserProfile = {
      skills: ["react", "python", "ml"],
      budget_range: "medium",
      niches: ["saas", "newsletter"],
      experience_level: "intermediate",
    };

    const result = calculateFitScore(profile, baseIdea);
    expect(result.fit_score).toBeGreaterThan(80);
    expect(result.fit_reason).toBeTruthy();
    expect(result.fit_reason.length).toBeGreaterThan(10);
  });

  it("scores < 30 for a no-match profile", () => {
    const profile: UserProfile = {
      skills: ["woodworking", "plumbing"],
      budget_range: "bootstrapped",
      niches: ["agriculture", "logistics"],
      experience_level: "beginner",
    };

    const idea: IdeaForScoring = {
      ...baseIdea,
      build_complexity: "high",
    };

    const result = calculateFitScore(profile, idea);
    expect(result.fit_score).toBeLessThan(30);
  });

  it("scores between 40-70 for a partial match", () => {
    const profile: UserProfile = {
      skills: ["react", "java"],
      budget_range: "low",
      niches: ["fintech"],
      experience_level: "intermediate",
    };

    const result = calculateFitScore(profile, baseIdea);
    expect(result.fit_score).toBeGreaterThanOrEqual(40);
    expect(result.fit_score).toBeLessThanOrEqual(70);
  });

  it("handles empty skills array", () => {
    const profile: UserProfile = {
      skills: [],
      budget_range: "medium",
      niches: ["saas"],
      experience_level: "advanced",
    };

    const result = calculateFitScore(profile, baseIdea);
    // skill_match = 0, but other factors still contribute
    expect(result.fit_score).toBeGreaterThanOrEqual(0);
    expect(result.fit_score).toBeLessThanOrEqual(100);
    expect(result.fit_reason).toBeTruthy();
  });

  it("handles null fields on idea", () => {
    const profile: UserProfile = {
      skills: ["react"],
      budget_range: "low",
      niches: ["saas"],
      experience_level: "intermediate",
    };

    const sparseIdea: IdeaForScoring = {
      title: "Simple Tool",
      one_liner: "A basic utility for developers using react",
      problem_statement: null,
      target_audience: null,
      build_complexity: "low",
      monetization_angle: null,
      source_type: "hackernews",
      competitors: [],
    };

    const result = calculateFitScore(profile, sparseIdea);
    expect(result.fit_score).toBeGreaterThanOrEqual(0);
    expect(result.fit_score).toBeLessThanOrEqual(100);
    // Should still detect "react" in one_liner
    expect(result.fit_reason).toContain("react");
  });

  it("returns score exactly 0-100 (clamped integer)", () => {
    const profile: UserProfile = {
      skills: [],
      budget_range: "bootstrapped",
      niches: [],
      experience_level: "beginner",
    };

    const idea: IdeaForScoring = {
      ...baseIdea,
      build_complexity: "high",
    };

    const result = calculateFitScore(profile, idea);
    expect(Number.isInteger(result.fit_score)).toBe(true);
    expect(result.fit_score).toBeGreaterThanOrEqual(0);
    expect(result.fit_score).toBeLessThanOrEqual(100);
  });

  it("generates a meaningful fit_reason mentioning matched skills", () => {
    const profile: UserProfile = {
      skills: ["react", "python"],
      budget_range: "medium",
      niches: [],
      experience_level: "intermediate",
    };

    const result = calculateFitScore(profile, baseIdea);
    expect(result.fit_reason).toContain("react");
    expect(result.fit_reason).toContain("python");
  });
});
