import { useState, useEffect } from "react";
import { useAuth, useUser, RedirectToSignIn } from "@clerk/clerk-react";
import AuthProvider from "./AuthProvider";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "/api";

interface SavedIdea {
  idea_id: string;
  rating: number | null;
  saved_at: string;
  title: string;
  one_liner: string;
  confidence_score: number;
  build_complexity: string;
  source_type: string;
}

const complexityConfig: Record<string, { color: string; label: string }> = {
  low: { color: "bg-green-500", label: "Low" },
  medium: { color: "bg-amber-500", label: "Med" },
  high: { color: "bg-red-500", label: "High" },
};

function DashboardContent() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [saved, setSaved] = useState<SavedIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [digestFreq, setDigestFreq] = useState<string>("off");
  const [digestEmail, setDigestEmail] = useState<string>("");
  const [digestSaving, setDigestSaving] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const token = await getToken();
        const [savedRes, digestRes] = await Promise.all([
          fetch(`${API_BASE}/saved`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/digest/preferences`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (savedRes.ok) {
          const data = await savedRes.json();
          setSaved(data.saved);
        }
        if (digestRes.ok) {
          const prefs = await digestRes.json();
          setDigestFreq(prefs.frequency ?? "off");
          if (prefs.email) setDigestEmail(prefs.email);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load saved ideas");
      } finally {
        setLoading(false);
      }
    })();
  }, [isSignedIn]);

  async function saveDigestPrefs() {
    setDigestSaving(true);
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/digest/preferences`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: digestEmail, frequency: digestFreq }),
      });
    } catch {
      // Silently fail
    } finally {
      setDigestSaving(false);
    }
  }

  async function unsave(ideaId: string) {
    const token = await getToken();
    await fetch(`${API_BASE}/saved/${ideaId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSaved(saved.filter((s) => s.idea_id !== ideaId));
  }

  if (!isLoaded) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-900 animate-pulse rounded-lg border border-gray-800" />
        ))}
      </div>
    );
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-bold text-white">
          {user?.firstName ? `${user.firstName}'s` : "Your"} Dashboard
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {saved.length} saved idea{saved.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Digest preferences */}
      <div className="border border-gray-800 rounded-lg bg-gray-900 p-4 mb-6">
        <h2 className="text-sm font-bold text-white mb-2">Email Digest</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="digest-email" className="text-xs text-gray-500 block mb-1">
              Email
            </label>
            <input
              id="digest-email"
              type="email"
              value={digestEmail}
              onChange={(e) => setDigestEmail(e.target.value)}
              placeholder={user?.primaryEmailAddress?.emailAddress ?? "you@example.com"}
              className="border border-gray-700 rounded px-2 py-1 bg-gray-800 text-gray-200 text-sm w-56"
            />
          </div>
          <div>
            <label htmlFor="digest-freq" className="text-xs text-gray-500 block mb-1">
              Frequency
            </label>
            <select
              id="digest-freq"
              value={digestFreq}
              onChange={(e) => setDigestFreq(e.target.value)}
              className="border border-gray-700 rounded px-2 py-1 bg-gray-800 text-gray-200 text-sm"
            >
              <option value="off">Off</option>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
          </div>
          <button
            onClick={saveDigestPrefs}
            disabled={digestSaving}
            className="bg-cyan-500 text-white px-3 py-1 rounded text-sm hover:bg-cyan-400 disabled:opacity-50 cursor-pointer"
          >
            {digestSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-900 animate-pulse rounded-lg border border-gray-800" />
          ))}
        </div>
      )}

      {error && (
        <div className="border border-gray-800 rounded-lg bg-gray-900 p-8 text-center">
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && saved.length === 0 && (
        <div className="border border-gray-800 rounded-lg bg-gray-900 p-8 text-center">
          <p className="text-white font-bold mb-1">No saved ideas yet.</p>
          <p className="text-gray-400 text-sm mb-3">
            Browse the feed and save ideas you want to explore further.
          </p>
          <a href="/" className="text-cyan-400 hover:underline text-sm">
            Browse ideas
          </a>
        </div>
      )}

      {!loading && !error && saved.length > 0 && (
        <div className="space-y-3">
          {saved.map((item) => {
            const cx = complexityConfig[item.build_complexity] ?? complexityConfig.medium;
            return (
              <article
                key={item.idea_id}
                className="border border-gray-800 rounded-lg bg-gray-900 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${cx.color} flex-shrink-0`}
                      />
                      <span className="text-[11px] font-mono text-gray-500 uppercase">
                        {cx.label}
                      </span>
                      <a
                        href={`/ideas/${item.idea_id}`}
                        className="font-bold text-white hover:underline truncate"
                      >
                        {item.title}
                      </a>
                    </div>
                    <p className="text-sm text-gray-400 leading-snug">
                      {item.one_liner}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-mono font-bold text-xs text-white">
                      {item.confidence_score}
                    </span>
                    {item.rating && (
                      <span className="text-amber-400 text-sm">
                        {"★".repeat(item.rating)}
                        <span className="text-gray-700">{"★".repeat(5 - item.rating)}</span>
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-gray-500 uppercase">
                      {item.source_type}
                    </span>
                    <button
                      onClick={() => unsave(item.idea_id)}
                      className="text-xs text-gray-500 hover:text-red-400 cursor-pointer"
                      aria-label="Remove saved idea"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
