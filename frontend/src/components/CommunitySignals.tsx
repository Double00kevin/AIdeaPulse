interface CommunitySignal {
  source: string;
  title: string;
  url: string;
  engagement: Record<string, number>;
  excerpt?: string;
  subreddit?: string;
  instance?: string;
  site?: string;
  repo?: string;
  post_type?: string;
}

interface Props {
  signals: CommunitySignal[];
}

const SOURCE_COLORS: Record<string, string> = {
  reddit: "border-orange-500/40",
  hackernews: "border-orange-400/40",
  producthunt: "border-blue-400/40",
  github_trending: "border-gray-400/40",
  github_issues: "border-gray-400/40",
  devto: "border-purple-400/40",
  lobsters: "border-red-400/40",
  newsapi: "border-sky-400/40",
  google_trends: "border-green-400/40",
  stackexchange: "border-yellow-400/40",
  discourse: "border-cyan-400/40",
  package_trends: "border-emerald-400/40",
};

const SOURCE_LABELS: Record<string, string> = {
  reddit: "Reddit",
  hackernews: "Hacker News",
  producthunt: "Product Hunt",
  github_trending: "GitHub Trending",
  github_issues: "GitHub Issues",
  devto: "Dev.to",
  lobsters: "Lobste.rs",
  newsapi: "News",
  google_trends: "Google Trends",
  stackexchange: "Stack Exchange",
  discourse: "Discourse",
  package_trends: "Package Trends",
};

function formatEngagement(engagement: Record<string, number>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(engagement)) {
    if (val === undefined || val === null) continue;
    const label = key.replace(/_/g, " ");
    parts.push(`${val.toLocaleString()} ${label}`);
  }
  return parts.join(" · ");
}

function sourceDetail(signal: CommunitySignal): string {
  if (signal.subreddit) return `r/${signal.subreddit}`;
  if (signal.site) return signal.site;
  if (signal.instance) return signal.instance;
  if (signal.repo) return signal.repo;
  if (signal.post_type) return signal.post_type;
  return "";
}

export default function CommunitySignals({ signals }: Props) {
  if (!signals || signals.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Community Signals ({signals.length})
      </h4>
      {signals.map((signal, i) => {
        const borderColor = SOURCE_COLORS[signal.source] ?? "border-gray-600/40";
        const label = SOURCE_LABELS[signal.source] ?? signal.source;
        const detail = sourceDetail(signal);
        const engText = formatEngagement(signal.engagement);

        return (
          <div
            key={i}
            className={`border-l-2 ${borderColor} pl-3 py-1.5`}
          >
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-gray-300">{label}</span>
              {detail && (
                <span className="text-gray-500">{detail}</span>
              )}
              {engText && (
                <span className="text-gray-500 ml-auto">{engText}</span>
              )}
            </div>
            {signal.url ? (
              <a
                href={signal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 truncate block mt-0.5"
              >
                {signal.title}
              </a>
            ) : (
              <span className="text-xs text-gray-400 truncate block mt-0.5">
                {signal.title}
              </span>
            )}
            {signal.excerpt && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                {signal.excerpt}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
