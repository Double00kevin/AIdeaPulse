import { useState, useEffect } from "react";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "/api";

interface Props {
  ideaId: string;
  initialSaved: boolean;
  initialRating: number | null;
}

export default function SaveButton({ ideaId, initialSaved, initialRating }: Props) {
  const [signedIn, setSignedIn] = useState(false);
  const [saved, setSaved] = useState(initialSaved);
  const [rating, setRating] = useState<number | null>(initialRating);
  const [busy, setBusy] = useState(false);

  // Use the global Clerk instance (loaded by HeaderAuth island)
  useEffect(() => {
    (async () => {
      try {
        const clerk = (window as any).Clerk;
        if (!clerk) return;
        await clerk.load();
        if (clerk.user) setSignedIn(true);
      } catch {
        // Clerk not available
      }
    })();
  }, []);

  if (!signedIn) return null;

  async function getToken(): Promise<string | null> {
    const clerk = (window as any).Clerk;
    return clerk?.session?.getToken() ?? null;
  }

  async function toggleSave() {
    setBusy(true);
    try {
      const token = await getToken();
      if (saved) {
        await fetch(`${API_BASE}/saved/${ideaId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        setSaved(false);
        setRating(null);
      } else {
        await fetch(`${API_BASE}/saved/${ideaId}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        setSaved(true);
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setBusy(false);
    }
  }

  async function setIdeaRating(newRating: number) {
    const value = newRating === rating ? null : newRating;
    setBusy(true);
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/saved/${ideaId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rating: value ?? undefined }),
      });
      setSaved(true);
      setRating(value);
    } catch {
      // Silently fail
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleSave}
        disabled={busy}
        className={`text-xs px-2 py-0.5 rounded border transition-colors cursor-pointer ${
          saved
            ? "border-cyan-500 text-cyan-400 bg-cyan-500/10"
            : "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500"
        } ${busy ? "opacity-50" : ""}`}
        aria-label={saved ? "Unsave idea" : "Save idea"}
      >
        {saved ? "Saved" : "Save"}
      </button>

      {saved && (
        <div className="flex items-center gap-0.5" role="group" aria-label="Rate this idea">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setIdeaRating(star)}
              disabled={busy}
              className={`text-sm cursor-pointer transition-colors ${
                rating && star <= rating
                  ? "text-amber-400"
                  : "text-gray-700 hover:text-amber-300"
              }`}
              aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
            >
              ★
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
