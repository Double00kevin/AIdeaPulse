import { useState, useEffect } from "react";
import TrendChart from "./TrendChart";

const API_BASE = import.meta.env.PUBLIC_API_URL || "/api";

interface Trend {
  keyword: string;
  source: string;
  volume: number;
  growth_pct: number;
  related_topics: string[];
  snapshot_date: string;
}

interface TrendDetail {
  keyword: string;
  volume: number;
  growth_pct: number;
  related_topics: string[];
  time_series?: Array<{ date: string; value: number }>;
  time_series_gated?: boolean;
  history?: Array<{ snapshot_date: string; volume: number; growth_pct: number }>;
}

async function getClerkToken(): Promise<string | null> {
  const clerk = (window as any).Clerk;
  if (!clerk) return null;
  await clerk.load();
  if (!clerk.user) return null;
  return (await clerk.session?.getToken()) ?? null;
}

export default function TrendsDashboard() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<TrendDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/trends?days=30&limit=50`);
        if (res.ok) {
          const data = await res.json();
          setTrends(data.trends ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function selectKeyword(keyword: string) {
    setSelected(keyword);
    setDetailLoading(true);
    setDetail(null);

    try {
      const token = await getClerkToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(
        `${API_BASE}/trends/${encodeURIComponent(keyword)}`,
        { headers },
      );
      if (res.ok) {
        setDetail(await res.json());
      }
    } finally {
      setDetailLoading(false);
    }
  }

  const filtered = search
    ? trends.filter((t) => t.keyword.toLowerCase().includes(search.toLowerCase()))
    : trends;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-800/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search trends..."
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400/50"
      />

      {/* Keyword Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((trend) => {
          const isUp = trend.growth_pct > 0;
          const isSelected = selected === trend.keyword;

          return (
            <button
              key={trend.keyword}
              onClick={() => selectKeyword(trend.keyword)}
              className={`text-left p-3 rounded-lg border transition-all ${
                isSelected
                  ? "border-cyan-400/50 bg-cyan-400/5"
                  : "border-gray-800 bg-gray-900/50 hover:border-gray-700"
              }`}
            >
              <p className="text-sm text-gray-200 font-medium truncate">
                {trend.keyword}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {trend.volume > 0 && (
                  <span className="text-xs text-gray-500">
                    {trend.volume.toLocaleString()} vol
                  </span>
                )}
                <span
                  className={`text-xs font-mono ${
                    isUp ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isUp ? "+" : ""}
                  {trend.growth_pct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-8">
          No trends found{search ? ` matching "${search}"` : ""}
        </p>
      )}

      {/* Detail Panel */}
      {selected && (
        <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
          <h3 className="text-lg font-semibold text-gray-200 mb-2">{selected}</h3>

          {detailLoading ? (
            <div className="h-24 bg-gray-800/50 rounded animate-pulse" />
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <span className="text-gray-400">
                  Volume: <span className="text-gray-200">{detail.volume.toLocaleString()}</span>
                </span>
                <span className="text-gray-400">
                  Growth:{" "}
                  <span
                    className={
                      detail.growth_pct > 0 ? "text-green-400" : "text-red-400"
                    }
                  >
                    {detail.growth_pct > 0 ? "+" : ""}
                    {detail.growth_pct}%
                  </span>
                </span>
              </div>

              {detail.related_topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.related_topics.map((topic) => (
                    <span
                      key={topic}
                      className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}

              {detail.time_series && detail.time_series.length > 1 ? (
                <TrendChart
                  data={detail.time_series}
                  width={600}
                  height={150}
                />
              ) : detail.time_series_gated ? (
                <div className="flex items-center justify-center h-32 bg-gray-800/30 rounded border border-gray-700/50">
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">
                      Time-series charts are available on Pro
                    </p>
                    <a
                      href="/pro"
                      className="text-cyan-400 text-xs hover:text-cyan-300 mt-1 inline-block"
                    >
                      Upgrade to Pro
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Could not load trend details</p>
          )}
        </div>
      )}
    </div>
  );
}
