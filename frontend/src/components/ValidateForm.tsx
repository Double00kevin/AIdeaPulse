/**
 * ValidateForm.tsx — "Validate My Own Idea" form + result display (Sprint 6)
 *
 * Standalone page component for /validate. Handles:
 * - Text input with character count
 * - Submit with loading state + double-click prevention
 * - Result display via ValidationResult component
 * - Auth gating via window.Clerk
 */

import { useState, useCallback } from "react";
import ValidationResult from "./ValidationResult";

const API_URL = import.meta.env.PUBLIC_API_URL || "";
const MAX_CHARS = 500;

export default function ValidateForm() {
  const [ideaText, setIdeaText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (loading || ideaText.trim().length < 10) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Get auth token from Clerk
      const clerk = (window as any).Clerk;
      if (!clerk?.session) {
        setError("Please sign in to validate ideas");
        setLoading(false);
        return;
      }

      const token = await clerk.session.getToken();
      if (!token) {
        setError("Authentication failed. Please sign in again.");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ idea_text: ideaText.trim() }),
      });

      if (res.status === 429) {
        const data = await res.json();
        setError(data.error || "Validation limit reached");
        if (data.upgrade) {
          setError(`${data.error}. Upgrade to Pro for 10 validations per day.`);
        }
        return;
      }

      if (res.status === 503) {
        setError("AI is busy, try again in a moment");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Analysis temporarily unavailable");
        return;
      }

      const data = await res.json();
      setResult(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [ideaText, loading]);

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-green-400 mb-2">Validate My Idea</h2>
      <p className="text-sm text-gray-400 mb-6">
        Submit your idea. We'll cross-reference it against 200+ demand signals from 12
        sources and give you a straight answer.
      </p>

      {/* Input form */}
      <div className="space-y-3">
        <textarea
          value={ideaText}
          onChange={(e) => setIdeaText(e.target.value.slice(0, MAX_CHARS))}
          placeholder="Describe your idea in 1-3 sentences. What does it do? Who is it for?

Example: A browser extension that tracks how much time developers spend reading docs vs writing code, with weekly reports and team leaderboards."
          className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-4 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-400/50 resize-y min-h-[100px]"
          rows={4}
          disabled={loading}
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">
            {ideaText.length}/{MAX_CHARS}
          </span>

          <button
            onClick={handleSubmit}
            disabled={loading || ideaText.trim().length < 10}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${
              loading || ideaText.trim().length < 10
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-green-400 text-gray-900 hover:bg-green-300"
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing...
              </span>
            ) : (
              "Validate This Idea"
            )}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-800/30 rounded-lg text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Result */}
      {result && <ValidationResult result={result} />}
    </div>
  );
}
