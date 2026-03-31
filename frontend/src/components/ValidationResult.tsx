/**
 * ValidationResult.tsx — SWOT grid display for "Validate My Own Idea" (Sprint 6)
 *
 * Shows confidence score circle + 4 SWOT quadrants + matched signals + next step.
 * Free tier: confidence + Strengths only, rest blurred.
 */

interface FullResult {
  tier: "pro";
  confidence_score: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  matched_signals: Array<{ source: string; title: string; relevance: string }>;
  next_step: string;
  remaining: number;
}

interface FreeResult {
  tier: "free";
  confidence_score: number;
  strengths: string[];
  matched_count: number;
  upgrade: boolean;
  remaining: number;
}

type Props = {
  result: FullResult | FreeResult;
};

function confidenceColor(score: number): string {
  if (score >= 7) return "border-green-400 text-green-400";
  if (score >= 4) return "border-amber-400 text-amber-400";
  return "border-red-400 text-red-400";
}

function SwotBox({
  label,
  items,
  colorClass,
  blurred = false,
}: {
  label: string;
  items: string[];
  colorClass: string;
  blurred?: boolean;
}) {
  return (
    <div className={`rounded-lg border border-gray-700/50 p-3 ${blurred ? "filter blur-[4px] select-none" : ""}`}>
      <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${colorClass}`}>
        {label}
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-gray-400 leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ValidationResult({ result }: Props) {
  const isFree = result.tier === "free";
  const fullResult = result.tier === "pro" ? result : null;

  return (
    <div className="mt-6 space-y-4">
      {/* Confidence score circle + header */}
      <div className="flex items-center gap-4">
        <div
          className={`w-16 h-16 rounded-full border-[3px] flex items-center justify-center text-xl font-bold ${confidenceColor(result.confidence_score)}`}
        >
          {result.confidence_score}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-200">
            {result.confidence_score >= 7
              ? "Strong opportunity"
              : result.confidence_score >= 4
                ? "Moderate opportunity"
                : "Weak signal"}
          </div>
          <div className="text-xs text-gray-500">
            Cross-referenced against 200+ demand signals
          </div>
        </div>
      </div>

      {/* SWOT Grid */}
      <div className="grid grid-cols-2 gap-2">
        <SwotBox
          label="Strengths"
          items={result.strengths}
          colorClass="text-green-400"
        />
        <SwotBox
          label="Weaknesses"
          items={isFree ? ["Upgrade to see weaknesses"] : (fullResult?.weaknesses ?? [])}
          colorClass="text-red-400"
          blurred={isFree}
        />
        <SwotBox
          label="Opportunities"
          items={isFree ? ["Upgrade to see opportunities"] : (fullResult?.opportunities ?? [])}
          colorClass="text-blue-400"
          blurred={isFree}
        />
        <SwotBox
          label="Threats"
          items={isFree ? ["Upgrade to see threats"] : (fullResult?.threats ?? [])}
          colorClass="text-amber-400"
          blurred={isFree}
        />
      </div>

      {/* Matched signals */}
      {fullResult?.matched_signals && fullResult.matched_signals.length > 0 && (
        <div className="text-xs text-green-400 pt-2 border-t border-gray-700/50">
          📡 Matched {fullResult.matched_signals.length} signal{fullResult.matched_signals.length > 1 ? "s" : ""} from{" "}
          {[...new Set(fullResult.matched_signals.map((s) => s.source))].join(", ")}
        </div>
      )}

      {isFree && (
        <div className="text-xs text-green-400 pt-2 border-t border-gray-700/50">
          📡 {(result as FreeResult).matched_count} matching signal{(result as FreeResult).matched_count !== 1 ? "s" : ""} found in our database
        </div>
      )}

      {/* Next step (Pro only) */}
      {fullResult?.next_step && (
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-1">
            Build This Weekend
          </div>
          <div className="text-xs text-gray-300 leading-relaxed">
            {fullResult.next_step}
          </div>
        </div>
      )}

      {/* Upgrade CTA for free users */}
      {isFree && (
        <div className="text-center py-3 bg-gray-800/30 rounded-lg border border-gray-700/30">
          <div className="text-sm text-gray-300 mb-1">🔒 Unlock full SWOT analysis</div>
          <div className="text-xs text-gray-500 mb-2">
            See weaknesses, opportunities, threats, matched signals, and your weekend build plan
          </div>
          <a
            href="/pro"
            className="text-xs text-green-400 hover:text-green-300 underline"
          >
            Upgrade to Pro — $12/mo
          </a>
        </div>
      )}

      {/* Remaining validations */}
      <div className="text-[10px] text-gray-600 text-center">
        {result.remaining} validation{result.remaining !== 1 ? "s" : ""} remaining{" "}
        {isFree ? "this month" : "today"}
      </div>
    </div>
  );
}
