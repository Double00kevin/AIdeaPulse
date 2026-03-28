import { useState, useEffect } from "react";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "/api";

export default function ProCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [clerkReady, setClerkReady] = useState(false);

  useEffect(() => {
    // Wait for Clerk to load (it's initialized by HeaderAuth's ClerkProvider)
    const check = () => {
      const clerk = (window as any).Clerk;
      if (clerk?.loaded) {
        setClerkReady(true);
        setIsSignedIn(!!clerk.user);
        return true;
      }
      return false;
    };

    if (!check()) {
      const interval = setInterval(() => {
        if (check()) clearInterval(interval);
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  async function handleCheckout() {
    const clerk = (window as any).Clerk;
    if (!clerk?.session) {
      setError("Please sign in first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await clerk.session.getToken();
      const res = await fetch(`${API_BASE}/stripe/checkout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `API error: ${res.status}`);
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (!clerkReady) {
    return (
      <div>
        <button disabled className="w-full bg-accent text-white py-2 rounded text-sm font-medium opacity-50 cursor-not-allowed">
          Loading...
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full bg-accent text-white py-2 rounded text-sm font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
      >
        {loading ? "Redirecting to checkout..." : isSignedIn ? "Upgrade to Pro" : "Sign in to upgrade"}
      </button>
      {error && (
        <p className="text-red-500 text-xs mt-2">{error}</p>
      )}
    </div>
  );
}
