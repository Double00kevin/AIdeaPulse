import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = import.meta.env.PUBLIC_API_URL ?? "/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const SKILLS = [
  "python", "javascript", "typescript", "react", "node", "go", "rust",
  "swift", "flutter", "devops", "cloud", "ml_ai", "data", "design",
  "marketing", "sales", "finance", "ops", "no_code",
] as const;

const NICHES = [
  "ai_ml", "developer_tools", "saas", "marketplace", "fintech",
  "healthtech", "edtech", "ecommerce", "social", "productivity",
  "security", "infrastructure", "no_code", "mobile", "api", "analytics",
] as const;

const BUDGET_OPTIONS = [
  { value: "bootstrapped", label: "Bootstrapped", detail: "$0–500" },
  { value: "low", label: "Low", detail: "$500–5K" },
  { value: "medium", label: "Medium", detail: "$5K–25K" },
  { value: "high", label: "High", detail: "$25K+" },
] as const;

const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "expert", label: "Expert" },
] as const;

function chipLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\bml ai\b/i, "ML/AI").replace(/\bno code\b/i, "No-Code");
}

async function getToken(): Promise<string | null> {
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

export default function ProfileSetup({ isOpen, onClose, onSaved }: Props) {
  const [skills, setSkills] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState<string>("low");
  const [niches, setNiches] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<string>("beginner");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Load existing profile on open
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) { setLoading(false); return; }
        const res = await fetch(`${API_BASE}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setSkills(data.profile.skills ?? []);
            setBudgetRange(data.profile.budget_range ?? "low");
            setNiches(data.profile.niches ?? []);
            setExperienceLevel(data.profile.experience_level ?? "beginner");
          }
        }
      } catch {
        // Non-critical — form starts with defaults
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen]);

  // Focus management
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  // Escape to close
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  function toggleChip(
    list: string[],
    setter: (v: string[]) => void,
    value: string,
    max: number,
  ) {
    if (list.includes(value)) {
      setter(list.filter((v) => v !== value));
    } else if (list.length < max) {
      setter([...list, value]);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) { setError("Sign in required"); setSaving(false); return; }
      const res = await fetch(`${API_BASE}/profile`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          skills,
          budget_range: budgetRange,
          niches,
          experience_level: experienceLevel,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Error ${res.status}`);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Smart Match Profile Setup"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto outline-none"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-white">Smart Match Profile</h2>
            <p className="text-xs text-gray-500 mt-0.5">Personalize your idea feed</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Skills */}
            <fieldset>
              <legend className="text-[11px] font-mono text-gray-500 uppercase tracking-wide mb-3">
                Skills <span className="text-gray-600">({skills.length}/10)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {SKILLS.map((skill) => {
                  const selected = skills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleChip(skills, setSkills, skill, 10)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        selected
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                          : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                      }`}
                      aria-pressed={selected}
                    >
                      {chipLabel(skill)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Budget */}
            <fieldset>
              <legend className="text-[11px] font-mono text-gray-500 uppercase tracking-wide mb-3">
                Budget Range
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {BUDGET_OPTIONS.map((opt) => {
                  const selected = budgetRange === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        selected
                          ? "bg-cyan-500/10 border-cyan-500/40 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="budget"
                        value={opt.value}
                        checked={selected}
                        onChange={() => setBudgetRange(opt.value)}
                        className="sr-only"
                      />
                      <div>
                        <div className="text-xs font-medium">{opt.label}</div>
                        <div className="text-[10px] text-gray-500">{opt.detail}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Interests */}
            <fieldset>
              <legend className="text-[11px] font-mono text-gray-500 uppercase tracking-wide mb-3">
                Interests <span className="text-gray-600">({niches.length}/8)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {NICHES.map((niche) => {
                  const selected = niches.includes(niche);
                  return (
                    <button
                      key={niche}
                      type="button"
                      onClick={() => toggleChip(niches, setNiches, niche, 8)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        selected
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                          : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600"
                      }`}
                      aria-pressed={selected}
                    >
                      {chipLabel(niche)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Experience */}
            <fieldset>
              <legend className="text-[11px] font-mono text-gray-500 uppercase tracking-wide mb-3">
                Experience Level
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {EXPERIENCE_OPTIONS.map((opt) => {
                  const selected = experienceLevel === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        selected
                          ? "bg-cyan-500/10 border-cyan-500/40 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="experience"
                        value={opt.value}
                        checked={selected}
                        onChange={() => setExperienceLevel(opt.value)}
                        className="sr-only"
                      />
                      <span className="text-xs font-medium">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Error */}
            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors cursor-pointer"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
