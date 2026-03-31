import { useState, useEffect } from "react";
import IdeaCard from "./IdeaCard";
import ProfileSetup from "./ProfileSetup";

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
  fit_score?: number;
  fit_reason?: string;
  // Sprint 5 additions
  narrative_writeup?: string;
  product_name?: string;
  validation_playbook?: string;
  gtm_strategy?: string;
  scores?: { opportunity?: number; pain_level?: number; builder_confidence?: number; timing?: number };
  community_signals?: Array<Record<string, unknown>>;
  signal_count?: number;
}

type Tier = "anon" | "free" | "pro";

interface FeedResponse {
  ideas: Idea[];
  next_cursor: string | null;
  has_more: boolean;
  tier?: Tier;
  daily_free_idea_id?: string | null;
}

interface SavedEntry {
  idea_id: string;
  rating: number | null;
}

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "/api";

async function getClerkToken(): Promise<string | null> {
  try {
    const clerk = (window as any).Clerk;
    if (!clerk) return null;
    await clerk.load();
    if (!clerk.user) return null;
    return (await clerk.session?.getToken()) ?? null;
  } catch {
    return null;
  }
}

export default function IdeaFeed() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [savedMap, setSavedMap] = useState<Map<string, number | null>>(new Map());

  // Tier state
  const [tier, setTier] = useState<Tier>("anon");
  const [dailyFreeIdeaId, setDailyFreeIdeaId] = useState<string | null>(null);

  // Filters
  const [complexity, setComplexity] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [sort, setSort] = useState<string>("recent");

  // Smart Match
  const [smartMatch, setSmartMatch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  // Fetch saved ideas + subscription + profile status
  useEffect(() => {
    (async () => {
      try {
        const token = await getClerkToken();
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };

        // Fetch all three in parallel
        const [savedRes, subRes, profileRes] = await Promise.all([
          fetch(`${API_BASE}/saved`, { headers }),
          fetch(`${API_BASE}/subscription`, { headers }),
          fetch(`${API_BASE}/profile`, { headers }),
        ]);

        if (savedRes.ok) {
          const data: { saved: SavedEntry[] } = await savedRes.json();
          const map = new Map<string, number | null>();
          for (const entry of data.saved) {
            map.set(entry.idea_id, entry.rating);
          }
          setSavedMap(map);
        }

        if (subRes.ok) {
          const data = await subRes.json();
          setIsPro(data.plan === "pro" && data.active);
        }

        if (profileRes.ok) {
          const data = await profileRes.json();
          setHasProfile(data.profile !== null);
        }
      } catch {
        // Non-critical — feed works without saved/pro state
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
      if (smartMatch) params.set("smart_match", "true");

      // Always send auth header if signed in — this is how the API detects tier
      const fetchHeaders: Record<string, string> = {};
      const token = await getClerkToken();
      if (token) fetchHeaders["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/ideas?${params}`, {
        headers: fetchHeaders,
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data: FeedResponse = await res.json();
      setIdeas(append ? [...ideas, ...data.ideas] : data.ideas);
      setCursor(data.next_cursor);
      setHasMore(data.has_more);

      // Update tier state from API response
      if (data.tier) setTier(data.tier);
      if (data.daily_free_idea_id !== undefined) {
        setDailyFreeIdeaId(data.daily_free_idea_id);
      }
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
  }, [complexity, source, sort, smartMatch]);

  function handleSmartMatchClick() {
    if (hasProfile) {
      setSmartMatch(!smartMatch);
    } else {
      setShowProfile(true);
    }
  }

  /** Called when a free user claims their daily idea via the detail endpoint. */
  function handleClaim(ideaId: string) {
    setDailyFreeIdeaId(ideaId);
    // Re-fetch to get full data for the claimed idea
    fetchIdeas(false);
  }

  /** Determine if an idea should be gated based on tier and daily claim. */
  function isGated(ideaId: string): boolean {
    if (tier === "pro") return false;
    if (tier === "free") {
      return dailyFreeIdeaId !== ideaId;
    }
    return true; // anon
  }

  // Skeleton loader
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border border-gray-800 rounded-lg bg-gray-900 p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-800 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-800 rounded w-1/2 mb-3" />
            <div className="h-3 bg-gray-800 rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="border border-gray-800 rounded-lg bg-gray-900 p-8 text-center">
        <p className="text-gray-400 mb-3">Couldn't load ideas.</p>
        <button
          onClick={() => fetchIdeas(false)}
          className="text-cyan-400 hover:underline text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (ideas.length === 0) {
    return (
      <div className="border border-gray-800 rounded-lg bg-gray-900 p-8 text-center">
        <p className="text-white font-bold mb-1">Fresh ideas brewing.</p>
        <p className="text-gray-400 text-sm">
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
          <label htmlFor="complexity" className="text-gray-500">
            Complexity:
          </label>
          <select
            id="complexity"
            value={complexity}
            onChange={(e) => setComplexity(e.target.value)}
            className="border border-gray-700 rounded px-2 py-1 bg-gray-800 text-gray-200"
          >
            <option value="">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <label htmlFor="source" className="text-gray-500">
            Source:
          </label>
          <select
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="border border-gray-700 rounded px-2 py-1 bg-gray-800 text-gray-200"
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
          <label htmlFor="sort" className="text-gray-500">
            Sort:
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-gray-700 rounded px-2 py-1 bg-gray-800 text-gray-200"
          >
            <option value="recent">Recent</option>
            <option value="confidence">Confidence</option>
          </select>
        </div>

        {/* Smart Match toggle (Pro only) */}
        {isPro && (
          <button
            onClick={handleSmartMatchClick}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors cursor-pointer ${
              smartMatch
                ? "border-cyan-400 bg-cyan-500/10 text-cyan-400"
                : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
            }`}
            aria-pressed={smartMatch}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
            </svg>
            Smart Match
          </button>
        )}

        {/* Export button (Pro only) */}
        {isPro && (
          <button
            onClick={async () => {
              const token = await getClerkToken();
              if (!token) return;
              window.location.href = `${API_BASE}/export/ideas?scope=all`;
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors cursor-pointer text-xs"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7,10 12,15 17,10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
        )}
      </fieldset>

      {/* Ideas list */}
      <div className="space-y-3">
        {ideas.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            saved={savedMap.has(idea.id)}
            rating={savedMap.get(idea.id) ?? null}
            fitScore={idea.fit_score}
            fitReason={idea.fit_reason}
            gated={isGated(idea.id)}
            tier={tier}
            dailyFreeAvailable={tier === "free" && !dailyFreeIdeaId}
            onClaim={handleClaim}
          />
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-4 text-center">
          {loadingMore ? (
            <div className="border border-gray-800 rounded-lg bg-gray-900 p-4 animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-3/4 mx-auto" />
            </div>
          ) : (
            <button
              onClick={() => fetchIdeas(true)}
              className="text-sm text-cyan-400 hover:underline"
            >
              Load more ideas
            </button>
          )}
        </div>
      )}

      {/* End of feed */}
      {!hasMore && ideas.length > 0 && (
        <p className="mt-4 text-center text-xs text-gray-500">
          You've seen them all. New ideas tomorrow.
        </p>
      )}

      {/* Profile Setup Modal */}
      <ProfileSetup
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        onSaved={() => {
          setHasProfile(true);
          setSmartMatch(true);
          setShowProfile(false);
        }}
      />
    </div>
  );
}
