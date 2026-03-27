import { useState, useEffect } from "react";
import IdeaCard from "./IdeaCard";

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

interface FeedResponse {
  ideas: Idea[];
  next_cursor: string | null;
  has_more: boolean;
}

interface SavedEntry {
  idea_id: string;
  rating: number | null;
}

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "/api";

export default function IdeaFeed() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [savedMap, setSavedMap] = useState<Map<string, number | null>>(new Map());

  // Filters
  const [complexity, setComplexity] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [sort, setSort] = useState<string>("recent");

  // Fetch saved ideas using the global Clerk instance (shared across islands)
  useEffect(() => {
    (async () => {
      try {
        // Wait for global Clerk to be available (loaded by HeaderAuth island)
        const clerk = (window as any).Clerk;
        if (!clerk) return;
        await clerk.load();
        if (!clerk.user) return;

        const token = await clerk.session?.getToken();
        if (!token) return;

        const res = await fetch(`${API_BASE}/saved`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: { saved: SavedEntry[] } = await res.json();
          const map = new Map<string, number | null>();
          for (const entry of data.saved) {
            map.set(entry.idea_id, entry.rating);
          }
          setSavedMap(map);
        }
      } catch {
        // Non-critical — feed works without saved state
      }
    })();
  }, []);

  async function fetchIdeas(append = false) {
    if (append) setLoadingMore(true);
    else setLoading(true);

    setError(null);

    try {
      const params = new URLSearchParams();
      if (append && cursor) params.set("cursor", cursor);
      if (complexity) params.set("complexity", complexity);
      if (source) params.set("source", source);
      if (sort) params.set("sort", sort);

      const res = await fetch(`${API_BASE}/ideas?${params}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data: FeedResponse = await res.json();
      setIdeas(append ? [...ideas, ...data.ideas] : data.ideas);
      setCursor(data.next_cursor);
      setHasMore(data.has_more);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    setCursor(null);
    fetchIdeas(false);
  }, [complexity, source, sort]);

  // Skeleton loader
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border border-border rounded bg-surface p-4 animate-pulse"
          >
            <div className="h-4 bg-border rounded w-3/4 mb-2" />
            <div className="h-3 bg-border rounded w-1/2 mb-3" />
            <div className="h-3 bg-border rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="border border-border rounded bg-surface p-8 text-center">
        <p className="text-text-secondary mb-3">Couldn't load ideas.</p>
        <button
          onClick={() => fetchIdeas(false)}
          className="text-accent hover:underline text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (ideas.length === 0) {
    return (
      <div className="border border-border rounded bg-surface p-8 text-center">
        <p className="text-text-primary font-bold mb-1">Fresh ideas brewing.</p>
        <p className="text-text-secondary text-sm">
          AIdeaPulse analyzes startup signals from 8 sources daily.
          Check back tomorrow for new AI-analyzed ideas.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter bar */}
      <fieldset className="flex flex-wrap items-center gap-3 mb-4 text-xs">
        <legend className="sr-only">Filter ideas</legend>

        <div className="flex items-center gap-1">
          <label htmlFor="complexity" className="text-text-secondary">
            Complexity:
          </label>
          <select
            id="complexity"
            value={complexity}
            onChange={(e) => setComplexity(e.target.value)}
            className="border border-border rounded px-2 py-1 bg-surface text-text-primary"
          >
            <option value="">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <label htmlFor="source" className="text-text-secondary">
            Source:
          </label>
          <select
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="border border-border rounded px-2 py-1 bg-surface text-text-primary"
          >
            <option value="">All</option>
            <option value="reddit">Reddit</option>
            <option value="hackernews">Hacker News</option>
            <option value="producthunt">Product Hunt</option>
            <option value="github_trending">GitHub</option>
            <option value="devto">Dev.to</option>
            <option value="lobsters">Lobste.rs</option>
            <option value="newsapi">News</option>
            <option value="google_trends">Trends</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <label htmlFor="sort" className="text-text-secondary">
            Sort:
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-border rounded px-2 py-1 bg-surface text-text-primary"
          >
            <option value="recent">Recent</option>
            <option value="confidence">Confidence</option>
          </select>
        </div>
      </fieldset>

      {/* Ideas list */}
      <div className="space-y-3">
        {ideas.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            saved={savedMap.has(idea.id)}
            rating={savedMap.get(idea.id) ?? null}
          />
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-4 text-center">
          {loadingMore ? (
            <div className="border border-border rounded bg-surface p-4 animate-pulse">
              <div className="h-4 bg-border rounded w-3/4 mx-auto" />
            </div>
          ) : (
            <button
              onClick={() => fetchIdeas(true)}
              className="text-sm text-accent hover:underline"
            >
              Load more ideas
            </button>
          )}
        </div>
      )}

      {/* End of feed */}
      {!hasMore && ideas.length > 0 && (
        <p className="mt-4 text-center text-xs text-text-secondary">
          You've seen them all. New ideas tomorrow.
        </p>
      )}
    </div>
  );
}
