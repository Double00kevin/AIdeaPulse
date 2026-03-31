/**
 * IdeaGenerator.tsx — Personalized idea generation page (Sprint 6, Phase 6B)
 *
 * Shows user's Smart Match profile, generates 3 ideas via Sonnet.
 * Free: see 1 idea, rest blurred. Pro: all 3, 5/day.
 */

import { useState, useEffect } from "react";

const API_URL = import.meta.env.PUBLIC_API_URL || "";

interface GeneratedIdea {
  name: string;
  description: string;
  fit_score: number;
  matched_signals: string;
  why_this_fits: string;
}

interface Profile {
  skills: string[];
  niches: string[];
  budget_range: string;
  experience_level: string;
}

function fitColor(score: number): string {
  if (score >= 80) return "text-green-400 border-green-400/30";
  if (score >= 50) return "text-amber-400 border-amber-400/30";
  return "text-gray-400 border-gray-500/30";
}

export default function IdeaGenerator() {
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<GeneratedIdea[]>([]);
  const [lockedCount, setLockedCount] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [tier, setTier] = useState<"free" | "pro">("free");

  const handleGenerate = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);
    setIdeas([]);
    setLockedCount(0);

    try {
      const clerk = (window as any).Clerk;
      if (!clerk?.session) {
        setError("Please sign in to generate ideas");
        setLoading(false);
        return;
      }

      const token = await clerk.session.getToken();
      const res = await fetch(`${API_URL}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 400) {
        const data = await res.json();
        if (data.redirect) {
          setError("Set up your Smart Match profile first. Go to Dashboard → Profile Setup.");
        } else {
          setError(data.error);
        }
        setLoading(false);
        return;
      }

      if (res.status === 429) {
        const data = await res.json();
        setError(data.error);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Generation temporarily unavailable");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setIdeas(data.ideas);
      setLockedCount(data.locked_count ?? 0);
      setRemaining(data.remaining);
      setTier(data.tier);
      if (data.profile) setProfile(data.profile);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-green-400 mb-2">Idea Generator</h2>
      <p className="text-sm text-gray-400 mb-6">
        Generate startup ideas tailored to your skills, budget, and interests.
        Powered by your Smart Match profile + 200+ analyzed demand signals.
      </p>

      {/* Profile summary */}
      {profile && (
        <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-3 mb-4">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Your Profile</div>
          <div className="flex flex-wrap gap-1 mb-1">
            {profile.skills.map((s) => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-300">{s}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 mb-1">
            {profile.niches.map((n) => (
              <span key={n} className="text-[10px] px-2 py-0.5 rounded-full bg-green-900/30 text-green-300">{n}</span>
            ))}
          </div>
          <div className="text-[10px] text-gray-600">
            Budget: {profile.budget_range} · Experience: {profile.experience_level} ·{" "}
            <a href="/dashboard" className="text-green-400 hover:text-green-300">Edit profile</a>
          </div>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors mb-6 ${
          loading
            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
            : "bg-green-400 text-gray-900 hover:bg-green-300"
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating ideas for you...
          </span>
        ) : (
          "Generate Ideas"
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800/30 rounded-lg text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {ideas.length > 0 && (
        <div className="space-y-3">
          {ideas.map((idea, idx) => (
            <div
              key={idx}
              className="border border-gray-700/50 rounded-lg p-4 bg-gray-800/30"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-200">{idea.name}</h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${fitColor(idea.fit_score)}`}>
                  FIT {idea.fit_score}
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-2">{idea.description}</p>
              <div className="text-[11px] text-green-400">{idea.why_this_fits}</div>
              <div className="text-[10px] text-gray-600 mt-1">
                {"\u{1F4E1}"} {idea.matched_signals}
              </div>
            </div>
          ))}

          {/* Locked ideas for free users */}
          {lockedCount > 0 && (
            <div className="relative">
              <div className="space-y-3 filter blur-[4px] select-none pointer-events-none">
                {Array.from({ length: Math.min(lockedCount, 2) }).map((_, i) => (
                  <div key={i} className="border border-gray-700/30 rounded-lg p-4 bg-gray-800/20">
                    <div className="h-4 bg-gray-700/30 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-gray-700/20 rounded w-full mb-1" />
                    <div className="h-3 bg-gray-700/20 rounded w-2/3" />
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/60 rounded-lg">
                <span className="text-sm text-gray-300 mb-1">
                  {"\u{1F512}"} {lockedCount} more idea{lockedCount > 1 ? "s" : ""}
                </span>
                <a href="/pro" className="text-xs text-green-400 hover:text-green-300 underline">
                  Upgrade to Pro — $12/mo
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Remaining count */}
      {remaining !== null && (
        <div className="mt-4 text-[10px] text-gray-600 text-center">
          {remaining} generation{remaining !== 1 ? "s" : ""} remaining today
          {tier === "free" && (
            <> · <a href="/pro" className="text-green-400 hover:text-green-300 underline">Upgrade for 5/day</a></>
          )}
        </div>
      )}
    </div>
  );
}
