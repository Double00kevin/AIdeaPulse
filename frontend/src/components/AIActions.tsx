/**
 * AIActions.tsx — "Deep Dive" section on idea detail (Sprint 6, Phase 6B)
 *
 * 5 structured action buttons. Each triggers a Haiku API call via Workers.
 * Results display inline. Cached responses load instantly.
 */

import { useState } from "react";

const API_URL = import.meta.env.PUBLIC_API_URL || "";

interface ActionDef {
  key: string;
  icon: string;
  label: string;
  proOnly?: boolean;
}

const ACTIONS: ActionDef[] = [
  { key: "market_opportunity", icon: "\u{1F3AF}", label: "Deep dive: market opportunity" },
  { key: "technical_feasibility", icon: "\u{1F528}", label: "How hard to build solo?" },
  { key: "revenue_model", icon: "\u{1F4B0}", label: "Revenue model breakdown", proOnly: true },
  { key: "weekend_plan", icon: "\u{26A1}", label: "Weekend build plan", proOnly: true },
  { key: "competitors", icon: "\u{1F50D}", label: "Competitor landscape", proOnly: true },
];

interface ActionResult {
  action: string;
  label: string;
  cached: boolean;
  summary: string;
  details: string[];
  signal_references: string;
  remaining: number;
}

interface Props {
  ideaId: string;
  tier: "anon" | "free" | "pro";
}

export default function AIActions({ ideaId, tier }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ActionResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const handleAction = async (actionKey: string) => {
    if (loading) return;

    // Check if already loaded
    if (results[actionKey]) {
      setExpandedAction(expandedAction === actionKey ? null : actionKey);
      return;
    }

    setLoading(actionKey);
    setError(null);

    try {
      const clerk = (window as any).Clerk;
      if (!clerk?.session) {
        setError("Please sign in to use AI Actions");
        setLoading(null);
        return;
      }

      const token = await clerk.session.getToken();
      const res = await fetch(`${API_URL}/api/ideas/${ideaId}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: actionKey }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setError(data.error);
        setLoading(null);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Analysis temporarily unavailable");
        setLoading(null);
        return;
      }

      const data: ActionResult = await res.json();
      setResults((prev) => ({ ...prev, [actionKey]: data }));
      setExpandedAction(actionKey);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  if (tier === "anon") return null;

  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Deep Dive
      </h4>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ACTIONS.map((action) => {
          const isLocked = action.proOnly && tier !== "pro";
          const isLoading = loading === action.key;
          const hasResult = !!results[action.key];

          return (
            <button
              key={action.key}
              onClick={() => !isLocked && handleAction(action.key)}
              disabled={isLoading || isLocked}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors text-center ${
                isLocked
                  ? "border-gray-800 bg-gray-900/30 cursor-not-allowed opacity-50"
                  : hasResult
                    ? "border-green-400/30 bg-green-400/5 hover:border-green-400/50"
                    : "border-gray-700/50 hover:border-gray-600 bg-gray-800/30"
              }`}
            >
              <span className="text-lg">{action.icon}</span>
              <span className="text-[11px] text-gray-300 leading-tight">{action.label}</span>
              {isLocked && <span className="text-[9px] text-green-400">PRO</span>}
              {isLoading && (
                <svg className="animate-spin h-3 w-3 text-green-400" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {hasResult && !isLoading && <span className="text-[9px] text-green-400">Done</span>}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-2 p-2 bg-red-900/20 border border-red-800/30 rounded text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Result panel */}
      {expandedAction && results[expandedAction] && (
        <div className="mt-3 bg-gray-900/50 border border-gray-700/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-300">
              {results[expandedAction].label}
            </span>
            <span className="text-[10px] text-gray-600">
              {results[expandedAction].cached ? "cached" : "via Haiku"}
            </span>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed mb-3">
            {results[expandedAction].summary}
          </p>

          <ul className="space-y-2 mb-3">
            {results[expandedAction].details.map((detail, i) => (
              <li key={i} className="text-xs text-gray-400 leading-relaxed pl-3 border-l border-gray-700">
                {detail}
              </li>
            ))}
          </ul>

          {results[expandedAction].signal_references && (
            <div className="text-[11px] text-green-400 pt-2 border-t border-gray-700/50">
              {"\u{1F4E1}"} {results[expandedAction].signal_references}
            </div>
          )}
        </div>
      )}

      {/* Free tier CTA */}
      {tier === "free" && (
        <div className="mt-2 text-center text-xs text-gray-600">
          Free: 1 action/day · <a href="/pro" className="text-green-400 hover:text-green-300 underline">Upgrade for 30/day</a>
        </div>
      )}
    </div>
  );
}
