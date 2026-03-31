import { useState } from "react";

interface Scores {
  opportunity?: number;
  pain_level?: number;
  builder_confidence?: number;
  timing?: number;
}

interface Props {
  scores: Scores;
}

const DIMENSIONS = [
  { key: "opportunity", label: "Opportunity", description: "Market size + competitive gap" },
  { key: "pain_level", label: "Pain Level", description: "Signal strength + urgency" },
  { key: "builder_confidence", label: "Builder Confidence", description: "Feasibility + timeline" },
  { key: "timing", label: "Timing", description: "Trend velocity + readiness" },
] as const;

function barColor(score: number): string {
  if (score >= 80) return "bg-green-400";
  if (score >= 50) return "bg-amber-400";
  return "bg-gray-500";
}

function textColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 50) return "text-amber-400";
  return "text-gray-500";
}

export default function ScoreBreakdown({ scores }: Props) {
  const hasScores = Object.values(scores).some((v) => v !== undefined && v > 0);
  if (!hasScores) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Score Breakdown
      </h4>
      {DIMENSIONS.map(({ key, label, description }) => {
        const value = scores[key] ?? 0;
        return (
          <div key={key} className="flex items-center gap-3">
            <div className="w-36 shrink-0">
              <span className="text-xs text-gray-300">{label}</span>
            </div>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor(value)}`}
                style={{ width: `${value}%` }}
              />
            </div>
            <span className={`text-xs font-mono w-8 text-right ${textColor(value)}`}>
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
