import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import AuthProvider from "./AuthProvider";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "/api";

function ProCheckoutInner() {
  const { isSignedIn, getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    if (!isSignedIn) {
      // Clerk modal will handle sign-in; this shouldn't normally fire
      setError("Please sign in first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
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

export default function ProCheckout() {
  return (
    <AuthProvider>
      <ProCheckoutInner />
    </AuthProvider>
  );
}
