import { useState } from "react";
import SaveButton from "./SaveButton";

interface Idea {
  id: string;
  title: string;
  one_liner: string;
  problem_statement: string;
  target_audience: string;
  market_size: { tam?: string; sam?: string; som?: string };
  competitors: string[];
  competitor_count: number;
  build_complexity: "low" | "medium" | "high";
  build_timeline: string;
  monetization_angle: string;
  confidence_score: number;
  source_links: string[];
  source_type: string;
  created_at: string;
}

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
}

export default function IdeaCard({ idea, saved = false, rating = null, fitScore, fitReason }: Props) {
  const [expanded, setExpanded] = useState(false);
  const complexity = complexityConfig[idea.build_complexity] ?? complexityConfig.medium;

  return (
    <article
      className="border border-gray-800 rounded-lg bg-gray-900 p-4"
      aria-label={`Idea: ${idea.title}`}
    >
      {/* Headline row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${complexity.color} flex-shrink-0`}
              aria-hidden="true"
            />
            <span className="text-[11px] font-mono text-gray-500 uppercase tracking-wide">
              {complexity.label}
            </span>
            <a
              href={`/ideas/${idea.id}`}
              className="font-bold text-white leading-tight hover:underline truncate"
            >
              {idea.title}
            </a>
          </div>
          <p className="text-sm text-gray-400 leading-snug">
            {idea.one_liner}
          </p>
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
        <span
          className="font-mono font-bold text-white"
          aria-label={`Confidence score: ${idea.confidence_score} out of 100`}
        >
          {idea.confidence_score}
        </span>
        <span className="text-gray-500">
          {idea.competitor_count} competitor{idea.competitor_count !== 1 ? "s" : ""}
        </span>
        {idea.monetization_angle && (
          <span className="text-gray-500 truncate max-w-[200px]">
            {idea.monetization_angle}
          </span>
        )}
        <span className="text-gray-500 text-[10px] font-mono uppercase">
          {idea.source_type}
        </span>

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

          {idea.competitors.length > 0 && (
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

          {idea.source_links.length > 0 && (
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
