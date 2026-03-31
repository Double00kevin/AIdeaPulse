import { useState } from "react";
import SaveButton from "./SaveButton";
import ScoreBreakdown from "./ScoreBreakdown";
import CommunitySignals from "./CommunitySignals";

interface Idea {
  id: string;
  title: string;
  one_liner?: string;
  problem_statement?: string;
  target_audience?: string;
  market_size?: { tam?: string; sam?: string; som?: string };
  competitors?: string[];
  competitor_count?: number;
  build_complexity?: "low" | "medium" | "high";
  build_timeline?: string;
  monetization_angle?: string;
  confidence_score?: number;
  source_links?: string[];
  source_type?: string;
  created_at: string;
  // Sprint 5 additions
  narrative_writeup?: string;
  product_name?: string;
  validation_playbook?: string;
  gtm_strategy?: string;
  scores?: { opportunity?: number; pain_level?: number; builder_confidence?: number; timing?: number };
  community_signals?: Array<{
    source: string; title: string; url: string;
    engagement: Record<string, number>; excerpt?: string;
    subreddit?: string; instance?: string; site?: string; repo?: string; post_type?: string;
  }>;
  signal_count?: number;
}

type Tier = "anon" | "free" | "pro";

const complexityConfig = {
  low: { color: "bg-green-500", label: "Low" },
  medium: { color: "bg-amber-500", label: "Med" },
  high: { color: "bg-red-500", label: "High" },
};

interface Props {
  idea: Idea;
  saved?: boolean;
  rating?: number | null;
  fitScore?: number;
  fitReason?: string;
  gated?: boolean;
  tier?: Tier;
  dailyFreeAvailable?: boolean;
  onClaim?: (ideaId: string) => void;
}

export default function IdeaCard({
  idea,
  saved = false,
  rating = null,
  fitScore,
  fitReason,
  gated = false,
  tier = "pro",
  dailyFreeAvailable = false,
  onClaim,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const sourceType = idea.source_type ?? "";
  const complexity = idea.build_complexity
    ? complexityConfig[idea.build_complexity] ?? complexityConfig.medium
    : null;

  async function handleClaimClick() {
    if (claiming) return;
    setClaiming(true);
    try {
      const clerk = (window as any).Clerk;
      if (!clerk) return;
      await clerk.load();
      const token = await clerk.session?.getToken();
      if (!token) return;

      const API_BASE = import.meta.env.PUBLIC_API_URL ?? "/api";
      const res = await fetch(`${API_BASE}/ideas/${idea.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onClaim?.(idea.id);
      }
    } catch {
      // Claim failed silently — user can retry
    } finally {
      setClaiming(false);
    }
  }

  // --- ANON GATED STATE ---
  if (gated && tier === "anon") {
    return (
      <article
        className="border border-gray-800 rounded-lg bg-gray-900 p-4"
        aria-label={`Idea: ${idea.title}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {sourceType && (
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wide">
                  {sourceType}
                </span>
              )}
              <a
                href={`/ideas/${idea.id}`}
                className="font-bold text-white leading-tight hover:underline truncate"
              >
                {idea.title}
              </a>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-800 text-center">
          <p className="text-gray-500 text-xs mb-2">
            Sign up free to explore ideas
          </p>
          <a
            href="/sign-up"
            className="inline-block text-xs px-3 py-1.5 rounded border border-cyan-400/50 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
          >
            Create free account
          </a>
        </div>
      </article>
    );
  }

  // --- FREE GATED STATE ---
  if (gated && tier === "free") {
    return (
      <article
        className="border border-gray-800 rounded-lg bg-gray-900 p-4"
        aria-label={`Idea: ${idea.title}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {complexity && (
                <>
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${complexity.color} flex-shrink-0`}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wide">
                    {complexity.label}
                  </span>
                </>
              )}
              <a
                href={`/ideas/${idea.id}`}
                className="font-bold text-white leading-tight hover:underline truncate"
              >
                {idea.title}
              </a>
            </div>
          </div>
        </div>

        {/* Scan row — show available info */}
        <div className="flex items-center gap-4 mt-3 text-xs">
          {idea.confidence_score !== undefined && (
            <span
              className="font-mono font-bold text-white"
              aria-label={`Confidence score: ${idea.confidence_score} out of 100`}
            >
              {idea.confidence_score}
            </span>
          )}
          {sourceType && (
            <span className="text-gray-500 text-[10px] font-mono uppercase">
              {sourceType}
            </span>
          )}
          {idea.created_at && (
            <span className="text-gray-600 text-[10px]">
              {new Date(idea.created_at).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Gated overlay */}
        <div className="mt-3 pt-3 border-t border-gray-800 text-center">
          {dailyFreeAvailable ? (
            <button
              onClick={handleClaimClick}
              disabled={claiming}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-cyan-400/50 text-cyan-400 hover:bg-cyan-500/10 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {claiming ? "Unlocking..." : "Use your free daily unlock"}
            </button>
          ) : (
            <>
              <div className="flex items-center justify-center gap-1.5 text-gray-500 text-xs mb-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Upgrade to Pro to unlock all ideas
              </div>
              <a
                href="/pro"
                className="inline-block text-xs px-3 py-1.5 rounded border border-cyan-400/50 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
              >
                See Pro plans
              </a>
            </>
          )}
        </div>
      </article>
    );
  }

  // --- FULL (UNGATED) STATE — Pro users, or free user's claimed idea ---
  return (
    <article
      className="border border-gray-800 rounded-lg bg-gray-900 p-4"
      aria-label={`Idea: ${idea.title}`}
    >
      {/* Headline row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {complexity && (
              <>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${complexity.color} flex-shrink-0`}
                  aria-hidden="true"
                />
                <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wide">
                  {complexity.label}
                </span>
              </>
            )}
            <a
              href={`/ideas/${idea.id}`}
              className="font-bold text-white leading-tight hover:underline truncate"
            >
              {idea.title}
            </a>
            {idea.product_name && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-400 flex-shrink-0">
                {idea.product_name}
              </span>
            )}
          </div>
          {idea.one_liner && (
            <p className="text-sm text-gray-400 leading-snug">
              {idea.one_liner}
            </p>
          )}
        </div>
      </div>

      {/* Scan row: fit badge, confidence, competitors, monetization hint */}
      <div className="flex items-center gap-4 mt-3 text-xs">
        {fitScore !== undefined && (
          <span
            className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
              fitScore >= 80
                ? "text-green-400 bg-green-900/30"
                : fitScore >= 50
                  ? "text-amber-400 bg-amber-900/30"
                  : "text-gray-500 bg-gray-800"
            }`}
            title={fitReason}
          >
            FIT {fitScore}
          </span>
        )}
        {idea.confidence_score !== undefined && (
          <span
            className="font-mono font-bold text-white"
            aria-label={`Confidence score: ${idea.confidence_score} out of 100`}
          >
            {idea.confidence_score}
          </span>
        )}
        {idea.competitor_count !== undefined && (
          <span className="text-gray-500">
            {idea.competitor_count} competitor{idea.competitor_count !== 1 ? "s" : ""}
          </span>
        )}
        {idea.monetization_angle && (
          <span className="text-gray-500 truncate max-w-[200px]">
            {idea.monetization_angle}
          </span>
        )}
        {sourceType && (
          <span className="text-gray-500 text-[10px] font-mono uppercase">
            {sourceType}
          </span>
        )}

        <SaveButton ideaId={idea.id} initialSaved={saved} initialRating={rating} />

        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto text-gray-500 hover:text-gray-300 text-xs flex items-center gap-1"
          aria-expanded={expanded}
          aria-controls={`detail-${idea.id}`}
        >
          {expanded ? "Less" : "More"}
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expandable detail section */}
      {expanded && (
        <div
          id={`detail-${idea.id}`}
          className="mt-4 pt-4 border-t border-gray-800 text-sm space-y-3"
        >
          {idea.problem_statement && (
            <div>
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wide">
                Problem
              </span>
              <p className="text-gray-300 mt-0.5">{idea.problem_statement}</p>
            </div>
          )}

          {idea.target_audience && (
            <div>
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wide">
                Target
              </span>
              <p className="text-gray-300 mt-0.5">{idea.target_audience}</p>
            </div>
          )}

          {idea.market_size && (
            <div className="grid grid-cols-3 gap-3">
              {idea.market_size.tam && (
                <div>
                  <span className="text-[11px] font-mono text-gray-500">TAM</span>
                  <p className="font-mono text-xs text-white">{idea.market_size.tam}</p>
                </div>
              )}
              {idea.market_size.sam && (
                <div>
                  <span className="text-[11px] font-mono text-gray-500">SAM</span>
                  <p className="font-mono text-xs text-white">{idea.market_size.sam}</p>
                </div>
              )}
              {idea.market_size.som && (
                <div>
                  <span className="text-[11px] font-mono text-gray-500">SOM</span>
                  <p className="font-mono text-xs text-white">{idea.market_size.som}</p>
                </div>
              )}
            </div>
          )}

          {idea.competitors && idea.competitors.length > 0 && (
            <div>
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wide">
                Competitors
              </span>
              <p className="text-gray-300 mt-0.5">
                {idea.competitors.join(", ")}
              </p>
            </div>
          )}

          {idea.build_timeline && (
            <div>
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wide">
                Timeline
              </span>
              <p className="text-gray-300 mt-0.5">{idea.build_timeline}</p>
            </div>
          )}

          {/* Sprint 5: Score Breakdown */}
          {idea.scores && Object.keys(idea.scores).length > 0 && (
            <ScoreBreakdown scores={idea.scores} />
          )}

          {/* Sprint 5: Narrative Writeup */}
          {idea.narrative_writeup && (
            <div>
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wide">
                Business Case
              </span>
              <div className="text-gray-300 mt-1 text-sm leading-relaxed space-y-2">
                {idea.narrative_writeup.split("\n").filter(Boolean).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>
          )}

          {/* Sprint 5: Validation Playbook */}
          {idea.validation_playbook && (
            <div>
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wide">
                Validation Playbook
              </span>
              <div className="text-gray-300 mt-1 text-sm leading-relaxed space-y-1">
                {idea.validation_playbook.split("\n").filter(Boolean).map((step, i) => (
                  <p key={i}>{step}</p>
                ))}
              </div>
            </div>
          )}

          {/* Sprint 5: GTM Strategy */}
          {idea.gtm_strategy && (
            <div>
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wide">
                Go-to-Market Strategy
              </span>
              <p className="text-gray-300 mt-1 text-sm leading-relaxed">{idea.gtm_strategy}</p>
            </div>
          )}

          {/* Sprint 5: Community Signals */}
          {idea.community_signals && idea.community_signals.length > 0 && (
            <CommunitySignals signals={idea.community_signals} />
          )}

          {idea.source_links && idea.source_links.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {idea.source_links.map((link, i) => (
                <a
                  key={i}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cyan-400 hover:underline"
                >
                  Source {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
