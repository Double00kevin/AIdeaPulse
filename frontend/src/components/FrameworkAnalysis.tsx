/**
 * FrameworkAnalysis.tsx — "Quick Scores" section on idea detail (Sprint 6)
 *
 * Pro users: all 4 frameworks with scores + explanations
 * Free users: 1st framework header + score, rest blurred + upgrade CTA
 */

import { useState } from "react";

interface Framework {
  label: string;
  framework: string;
  score: number;
  explanation?: string;
}

interface Props {
  frameworks: Framework[];
  tier: "anon" | "free" | "pro";
}

function scoreColor(score: number): string {
  if (score >= 8) return "text-green-400";
  if (score >= 5) return "text-amber-400";
  return "text-gray-500";
}

function scoreBg(score: number): string {
  if (score >= 8) return "bg-green-400/10 border-green-400/30";
  if (score >= 5) return "bg-amber-400/10 border-amber-400/30";
  return "bg-gray-500/10 border-gray-500/30";
}

export default function FrameworkAnalysis({ frameworks, tier }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!Array.isArray(frameworks) || frameworks.length === 0) return null;

  const visibleFrameworks = tier === "pro" ? frameworks : frameworks.slice(0, 1);
  const lockedCount = tier !== "pro" ? Math.max(0, frameworks.length - 1) : 0;

  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Quick Scores
      </h4>

      <div className="space-y-2">
        {visibleFrameworks.map((fw, idx) => (
          <div key={idx}>
            <button
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors hover:border-gray-600 ${scoreBg(fw.score)}`}
            >
              <div className="text-left">
                <span className="text-sm font-medium text-gray-200">{fw.label}</span>
                {fw.framework && (
                  <span className="ml-2 text-[10px] text-gray-500">{fw.framework}</span>
                )}
              </div>
              <span className={`text-lg font-bold ${scoreColor(fw.score)}`}>
                {fw.score}/10
              </span>
            </button>

            {expandedIdx === idx && fw.explanation && tier === "pro" && (
              <div className="px-3 py-2 mx-1 border-x border-b border-gray-700/50 rounded-b-lg text-xs text-gray-400 leading-relaxed">
                {fw.explanation}
              </div>
            )}
          </div>
        ))}

        {lockedCount > 0 && (
          <div className="relative">
            {/* Blurred preview of remaining frameworks */}
            <div className="space-y-2 filter blur-[4px] select-none pointer-events-none">
              {frameworks.slice(1, 3).map((fw, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-700/30 bg-gray-800/30"
                >
                  <span className="text-sm text-gray-500">{fw.label}</span>
                  <span className="text-sm text-gray-600">{fw.score}/10</span>
                </div>
              ))}
            </div>

            {/* Upgrade overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/60 rounded-lg">
              <span className="text-sm text-gray-300 mb-1">
                🔒 {lockedCount} more framework{lockedCount > 1 ? "s" : ""}
              </span>
              <a
                href="/pro"
                className="text-xs text-green-400 hover:text-green-300 underline"
              >
                Upgrade to Pro — $12/mo
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
