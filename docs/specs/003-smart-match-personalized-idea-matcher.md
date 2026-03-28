# ADR-003: Smart Match — Personalized Idea Matcher

**Date:** 2026-03-27
**Status:** Implemented (ea50e31, 2026-03-27)
**Author:** Kevin Hillis
**Sprint:** Sprint 4 — Monetization + Launch

---

## Context

Free users see a limited preview of the daily feed, while Pro users get access to the full historical database of every idea ever captured. Pro users can also filter by complexity, source type, and sort by recency or confidence — so there's already some manual curation available. But the feed itself has no awareness of who the user is. This means:

- Pro offers volume (full archive) and manual filters, but the default experience is still generic — users have to actively hunt for relevant ideas every session
- Filters narrow the firehose but don't surface what's actually a good fit for a specific user's skills, budget, or interests
- No "set it and forget it" personalization — there's nothing that learns what you care about and puts the best matches at the top automatically

## Decision

Build **Smart Match**: a user profile system + personalized re-ranking engine that scores every daily idea against the user's skills, budget, preferred niches, and experience level. Exposed as a "Smart Match" toggle in the feed, Pro-only.

## Architecture Overview

```
User fills profile once → saved to D1 `user_profiles` table
  ↓
Toggle "Smart Match" in IdeaFeed → GET /api/ideas?smart_match=true
  ↓
Workers endpoint loads profile + ideas → runs fit scoring function
  ↓
Returns ideas with `fit_score` (0-100) + `fit_reason` (one sentence)
  ↓
IdeaFeed re-renders sorted by fit_score, IdeaCard shows fit badge
```

### Why Edge Scoring (Not Embeddings)

Cloudflare Workers has no GPU and a 30s CPU limit. Embedding-based cosine similarity would require either:
- Pre-computing embeddings for every idea (extra Claude API cost, storage)
- Calling an embedding API per request (latency, cost)

Instead: **weighted keyword + category match** running entirely on the edge. Fast, free, deterministic. Can upgrade to Cloudflare Workers AI embeddings later if needed (they support `@cf/baai/bge-base-en-v1.5` natively).

### Scoring Algorithm

```
fit_score = weighted sum of:
  skill_match    (35%) — overlap between user skills and idea's target_audience + build_complexity
  niche_match    (25%) — overlap between user preferred categories and idea's source_type + keywords
  budget_match   (20%) — user budget range vs idea's build_complexity proxy
  complexity_fit (20%) — user experience level vs idea's build_complexity
```

Each sub-score is 0-100, final score is the weighted average. `fit_reason` is a template string: "Matches your {skill} skills and {niche} interest. {complexity} build fits your {experience} level."

---

## D1 Schema Change

### Migration 0005: user_profiles

```sql
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  skills_json TEXT NOT NULL DEFAULT '[]',
  budget_range TEXT NOT NULL DEFAULT 'low'
    CHECK(budget_range IN ('bootstrapped', 'low', 'medium', 'high')),
  niches_json TEXT NOT NULL DEFAULT '[]',
  experience_level TEXT NOT NULL DEFAULT 'beginner'
    CHECK(experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**Fields:**
- `skills_json`: JSON array of skill tags, e.g. `["python", "react", "devops", "marketing"]`
- `budget_range`: bootstrapped ($0-500), low ($500-5k), medium ($5k-25k), high ($25k+)
- `niches_json`: JSON array of interest categories, e.g. `["ai_ml", "developer_tools", "saas", "marketplace"]`
- `experience_level`: maps to build_complexity tolerance

**Predefined skill tags** (user picks from list, can add custom):
`python, javascript, typescript, react, node, go, rust, swift, flutter, devops, cloud, ml_ai, data, design, marketing, sales, finance, ops, no_code`

**Predefined niche categories:**
`ai_ml, developer_tools, saas, marketplace, fintech, healthtech, edtech, ecommerce, social, productivity, security, infrastructure, no_code, mobile, api, analytics`

---

## API Endpoints

### `POST /api/profile` (authenticated, Pro-only)

Save or update user profile.

**Request body:**
```json
{
  "skills": ["python", "react", "ml_ai"],
  "budget_range": "low",
  "niches": ["ai_ml", "developer_tools"],
  "experience_level": "intermediate"
}
```

**Validation:**
- skills: array of strings, max 10 items, each max 50 chars
- budget_range: one of the 4 enum values
- niches: array of strings, max 8 items
- experience_level: one of the 4 enum values

**Response:** `{ "ok": true }`

### `GET /api/profile` (authenticated)

Returns current profile or `{ "profile": null }` if not set.

### `GET /api/ideas?smart_match=true` (existing endpoint, extended)

When `smart_match=true` AND user is authenticated AND has Pro plan AND has a profile:
1. Load ideas as normal (with existing filters)
2. Load user profile from D1
3. Run fit scoring on each idea
4. Sort by `fit_score` DESC (breaking ties by `confidence_score`)
5. Append `fit_score` and `fit_reason` to each idea in the response

If any condition fails (no auth, no Pro, no profile), ignore the param and return normal feed.

---

## Frontend Components

### `ProfileSetup.tsx` (new React island)

Lives at `/profile` or as a modal triggered from the feed. Form with:
- Multi-select chips for skills (predefined list + custom input)
- Radio group for budget range
- Multi-select chips for niches
- Radio group for experience level
- Save button → POST /api/profile

Show this as an onboarding prompt the first time a Pro user hits the feed without a profile. Dismissible, but re-accessible from the dashboard.

### `SmartMatchToggle` (added to IdeaFeed.tsx)

- Only renders for Pro users (check subscription status)
- Toggle switch: "Smart Match" with a sparkle icon
- When toggled on, adds `smart_match=true` to the API call
- If user has no profile, clicking the toggle opens ProfileSetup modal instead
- Persists toggle state in component state (resets on page reload is fine for v1)

### `FitBadge` (added to IdeaCard.tsx)

- Small badge next to confidence score showing fit_score when present
- Color-coded: green (80+), amber (50-79), gray (<50)
- Hover/tap shows `fit_reason` tooltip

---

## Security Considerations

- Profile endpoint requires Clerk JWT (existing `requireAuth()` middleware)
- Pro-only check: query `subscriptions` table before allowing profile save
- Input validation: Zod schema on profile body, reject unknown fields
- No PII in profile — skills/niches are categorical, not personal data
- Rate limit profile updates: max 10/day per user (prevent abuse)

---

## Implementation Order

1. **D1 migration** — create `user_profiles` table
2. **Workers routes** — `POST/GET /api/profile` with auth + Pro check
3. **Scoring function** — pure TypeScript function, unit-testable
4. **Extend ideas endpoint** — add `smart_match` param handling
5. **ProfileSetup.tsx** — React island with form
6. **SmartMatchToggle** — add to IdeaFeed.tsx
7. **FitBadge** — add to IdeaCard.tsx
8. **Integration test** — end-to-end with test profile + ideas

---

## Claude Code Prompts (Ready to Paste)

**IMPORTANT:** Before starting any prompt below, read this spec first for full context:
`docs/specs/003-smart-match-personalized-idea-matcher.md`

### Prompt 1: D1 Migration

→ CLAUDE CODE PROMPT:
```
Read docs/specs/003-smart-match-personalized-idea-matcher.md for full context on the Smart Match feature.

Create a new D1 migration file at workers/migrations/0005_user_profiles.sql with this content:

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  skills_json TEXT NOT NULL DEFAULT '[]',
  budget_range TEXT NOT NULL DEFAULT 'low'
    CHECK(budget_range IN ('bootstrapped', 'low', 'medium', 'high')),
  niches_json TEXT NOT NULL DEFAULT '[]',
  experience_level TEXT NOT NULL DEFAULT 'beginner'
    CHECK(experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  updated_at TEXT DEFAULT (datetime('now'))
);

Then run: wrangler d1 migrations apply ideavault --local
Then run: wrangler d1 migrations apply ideavault --remote

Verify the table exists with: wrangler d1 execute ideavault --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='user_profiles'"
```

### Prompt 2: Profile API Routes

→ CLAUDE CODE PROMPT:
```
Read docs/specs/003-smart-match-personalized-idea-matcher.md for full context on the Smart Match feature.

Create a new file workers/src/routes/profile.ts with two endpoints:

1. POST /profile — Save/update user profile
   - Use the existing requireAuth() middleware from workers/src/middleware/auth.ts
   - After auth, check the subscriptions table to verify the user has plan='pro' AND status='active'. If not Pro, return 403 { error: "Pro subscription required" }.
   - Validate the request body with Zod:
     - skills: z.array(z.string().max(50)).max(10)
     - budget_range: z.enum(['bootstrapped', 'low', 'medium', 'high'])
     - niches: z.array(z.string().max(50)).max(8)
     - experience_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert'])
   - Upsert into user_profiles table (INSERT OR REPLACE), storing skills as skills_json and niches as niches_json (JSON.stringify the arrays).
   - Set updated_at to datetime('now').
   - Return { ok: true }.

2. GET /profile — Get current user profile
   - Use requireAuth() middleware.
   - Query user_profiles by user_id.
   - If found, parse skills_json and niches_json back to arrays and return { profile: { skills, budget_range, niches, experience_level } }.
   - If not found, return { profile: null }.

Then register the route in workers/src/index.ts:
   import { profileHandler } from "./routes/profile";
   app.route("/api/profile", profileHandler);

Add it AFTER the saved route and BEFORE the stripe route. Follow the same Hono pattern used in the existing route files (look at workers/src/routes/saved.ts for reference).
```

### Prompt 3: Fit Scoring Function

→ CLAUDE CODE PROMPT:
```
Read docs/specs/003-smart-match-personalized-idea-matcher.md for full context on the Smart Match feature, especially the "Scoring Algorithm" section.

Create a new file workers/src/scoring/fitScore.ts — a pure function that scores how well an idea matches a user profile.

Input types:
interface UserProfile {
  skills: string[];
  budget_range: 'bootstrapped' | 'low' | 'medium' | 'high';
  niches: string[];
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

interface IdeaForScoring {
  title: string;
  one_liner: string;
  problem_statement: string | null;
  target_audience: string | null;
  build_complexity: 'low' | 'medium' | 'high';
  monetization_angle: string | null;
  source_type: string;
  competitors: string[];
}

Output type:
interface FitResult {
  fit_score: number; // 0-100
  fit_reason: string; // one sentence
}

Scoring logic (all sub-scores 0-100, then weighted average):

1. skill_match (35%): Count how many of the user's skills appear as substrings (case-insensitive) in the idea's target_audience + one_liner + problem_statement + monetization_angle. Normalize: 0 matches = 0, 1 match = 40, 2 matches = 70, 3+ matches = 100.

2. niche_match (25%): Map source_type to niche categories (e.g. 'github_trending' → 'developer_tools', 'google_trends' → infer from title keywords). Also check if any user niche keywords appear in the idea title or one_liner. Any match = 100, no match = 0, partial keyword overlap = 50.

3. budget_match (20%): Map build_complexity to budget tiers:
   - low complexity → fits bootstrapped, low, medium, high (all get 100)
   - medium complexity → bootstrapped gets 30, low gets 70, medium/high get 100
   - high complexity → bootstrapped gets 10, low gets 40, medium gets 80, high gets 100

4. complexity_fit (20%): Map experience_level to preferred complexity:
   - beginner → low=100, medium=40, high=10
   - intermediate → low=70, medium=100, high=50
   - advanced → low=40, medium=80, high=100
   - expert → low=30, medium=70, high=100

Generate fit_reason as a template: pick the top 1-2 matching factors and describe them in plain English. Example: "Matches your React and ML skills. Low complexity fits your budget."

Export the function as: export function calculateFitScore(profile: UserProfile, idea: IdeaForScoring): FitResult

Write vitest unit tests in workers/src/scoring/fitScore.test.ts covering:
- Perfect match profile (all factors high) → score > 80
- No match profile (nothing overlaps) → score < 30
- Partial match → score between 40-70
- Edge case: empty skills array
- Edge case: null fields on idea
```

### Prompt 4: Extend Ideas Endpoint

→ CLAUDE CODE PROMPT:
```
Read docs/specs/003-smart-match-personalized-idea-matcher.md for full context on the Smart Match feature.

Modify workers/src/routes/ideas.ts to support Smart Match.

When the query param smart_match=true is present:
1. Check if the request has an Authorization header. If not, ignore smart_match and return normal feed.
2. If auth header exists, verify the JWT using the same logic as requireAuth() but don't block — just extract userId or null.
3. If userId exists, check subscriptions table for pro plan.
4. If pro, load user_profiles for that userId.
5. If profile exists, after fetching ideas from D1, run calculateFitScore() on each idea.
6. Sort by fit_score DESC (tie-break: confidence_score DESC).
7. Add fit_score and fit_reason to each idea object in the response.

If any step fails (no auth, no pro, no profile), silently fall back to normal feed — no error, just ignore smart_match.

Import calculateFitScore from '../scoring/fitScore'.

Keep the existing filters (complexity, source, sort) working — smart_match is applied AFTER those filters. The sort param is overridden to fit_score when smart_match is active.

Do NOT change the response shape for non-smart-match requests. The fit_score and fit_reason fields should only appear when smart_match scoring was actually applied.
```

### Prompt 5: ProfileSetup React Component

→ CLAUDE CODE PROMPT:
```
Read docs/specs/003-smart-match-personalized-idea-matcher.md for full context on the Smart Match feature, especially the "Frontend Components" and "D1 Schema Change" sections for the predefined skill/niche lists.

Create frontend/src/components/ProfileSetup.tsx — a React island for the Smart Match profile form.

Requirements:
- Modal overlay (centered, dark backdrop, rounded card matching the existing gray-900 design)
- Props: { isOpen: boolean, onClose: () => void, onSaved: () => void }
- Uses the global Clerk instance (same pattern as IdeaFeed.tsx and SaveButton.tsx — access via (window as any).Clerk)
- Four sections:

  1. Skills — chips/tags from predefined list: python, javascript, typescript, react, node, go, rust, swift, flutter, devops, cloud, ml_ai, data, design, marketing, sales, finance, ops, no_code. Click to toggle. Max 10.

  2. Budget — radio group: Bootstrapped ($0-500), Low ($500-5K), Medium ($5K-25K), High ($25K+)

  3. Interests — chips/tags from predefined list: ai_ml, developer_tools, saas, marketplace, fintech, healthtech, edtech, ecommerce, social, productivity, security, infrastructure, no_code, mobile, api, analytics. Click to toggle. Max 8.

  4. Experience — radio group: Beginner, Intermediate, Advanced, Expert

- On mount, GET /api/profile to pre-populate if profile exists.
- Save button → POST /api/profile with the form data. Show loading state. On success, call onSaved() and close.
- Match existing design: gray-900 bg, gray-800 borders, cyan-400 accent, text-sm, font-mono for labels.
- Accessible: proper labels, focus management on open, Escape to close.
```

### Prompt 6: Wire Smart Match Toggle into IdeaFeed

→ CLAUDE CODE PROMPT:
```
Read docs/specs/003-smart-match-personalized-idea-matcher.md for full context on the Smart Match feature.

Modify frontend/src/components/IdeaFeed.tsx to add Smart Match functionality:

1. Add state: const [smartMatch, setSmartMatch] = useState(false);
   Add state: const [showProfile, setShowProfile] = useState(false);
   Add state: const [isPro, setIsPro] = useState(false);
   Add state: const [hasProfile, setHasProfile] = useState(false);

2. In the existing useEffect that fetches saved ideas, also:
   - Fetch GET /api/subscription to check if user is Pro. Set isPro.
   - Fetch GET /api/profile to check if profile exists. Set hasProfile.

3. Add a Smart Match toggle in the filter bar (only render if isPro is true):
   - Toggle switch styled as a small button with cyan-400 border when active
   - Label: "Smart Match" with a sparkle/star icon (inline SVG, keep it simple)
   - On click: if hasProfile, toggle smartMatch state. If !hasProfile, open ProfileSetup modal.

4. When smartMatch is true, add smart_match=true to the API params in fetchIdeas().
   Also pass the Authorization header (get token from Clerk same as saved ideas fetch).

5. Import and render ProfileSetup modal:
   <ProfileSetup isOpen={showProfile} onClose={() => setShowProfile(false)} onSaved={() => { setHasProfile(true); setSmartMatch(true); setShowProfile(false); }} />

6. Update the Idea interface to include optional fields:
   fit_score?: number;
   fit_reason?: string;

7. Pass fit_score and fit_reason through to IdeaCard as new optional props.
```

### Prompt 7: Add FitBadge to IdeaCard

→ CLAUDE CODE PROMPT:
```
Read docs/specs/003-smart-match-personalized-idea-matcher.md for full context on the Smart Match feature.

Modify frontend/src/components/IdeaCard.tsx to display the fit score when present:

1. Add optional props to the Props interface:
   fitScore?: number;
   fitReason?: string;

2. In the "scan row" (the flex row with confidence, competitors, monetization), add a FitBadge BEFORE the confidence score span, only when fitScore is defined:
   - Small pill/badge: "FIT {fitScore}" in font-mono text-xs
   - Color: green-400 text + green-900/30 bg if fitScore >= 80, amber-400 + amber-900/30 if 50-79, gray-500 if < 50
   - Title attribute (tooltip) set to fitReason

3. Keep everything else the same. The FitBadge should not appear at all when fitScore is undefined (normal feed without Smart Match).
```

---

## Success Metrics

- **Activation:** >30% of Pro users create a profile within 7 days
- **Engagement:** Pro users with Smart Match ON have >2x session duration vs OFF
- **Retention:** Pro churn drops by 15% in first 60 days after launch

## Future Enhancements (v2)

- Cloudflare Workers AI embeddings (`@cf/baai/bge-base-en-v1.5`) for semantic matching instead of keyword overlap
- Learning from user saves/ratings to auto-tune the profile weights
- "Why this idea?" explainer card that breaks down the fit score components
- Custom skill tags (user-defined, not just predefined list)

---

## Features 2-5: Backlog Summary

These are queued for implementation after Smart Match ships and is validated. Each gets its own ADR when promoted to active development.

### Feature 2: One-Click Execution Kit Generator
**Value:** Highest perceived value — turn idea card into downloadable roadmap + starter repo scaffold + validation checklist.
**Approach:** Button on IdeaCard → triggers Claude API call (Sonnet) with idea JSON → returns markdown roadmap, project scaffold description, and competitor matrix. Render as downloadable .md or .zip.
**Pricing:** $29 one-time per kit, or bundled in a top-tier Pro plan.
**Key decision:** Generate actual code files (Next.js + Supabase boilerplate) or just markdown instructions? Real code = higher value but more maintenance.
**Dependencies:** None beyond existing Claude API integration.

### Feature 3: Deep Validation Reports + "Validate My Own Idea"
**Value:** Two features in one. Pro users get "Deep Dive" button (extra Claude pass for risk matrix, GTM timeline, first 10 customers list). Plus new endpoint: user submits their own idea text → pipeline runs same 8-source cross-check + Claude analysis.
**Approach:** New analysis module in pipeline/ that takes free-text input. New Workers endpoint POST /api/validate. Claude Sonnet produces extended report. Render as HTML or PDF via browser print.
**Pricing:** Usage-based: $5-10 per deep report. Higher Pro tier for bundled reports.
**Dependencies:** Needs thought on rate limiting per-report Claude API costs.

### Feature 4: Auto Content Engine
**Value:** Traffic + affiliate revenue. Daily top 5 ideas → Claude auto-generates Twitter/LinkedIn threads with CTAs to aideapulse.com + affiliate links.
**Approach:** New pipeline step after daily analysis. Claude generates content packs per idea. Store in D1 or R2. Pro users get "Export content pack" button. Kevin posts the public ones manually or via Buffer/Typefully.
**Pricing:** Pro feature (export content pack). Affiliate revenue from tool links in briefs.
**Dependencies:** Affiliate program signups (Vercel, Stripe, etc.). Content review workflow.

### Feature 5: Niche Curated Packs
**Value:** Digital product side hustle. Monthly themed packs ("AI Agent Ideas Pack", "Indie Hacker 2026", "No-Code Only") — 20 ideas with extra analysis.
**Approach:** One-off pipeline script that filters + bundles ideas by theme. Claude adds extended commentary. Package as PDF. Sell on Gumroad for $49-99.
**Pricing:** One-time purchase on Gumroad.
**Dependencies:** Gumroad account. PDF generation (Resend or puppeteer). Enough idea volume per niche.

---

## Appendix: Current Schema Reference

**ideas table** (migration 0001): id, title, title_normalized, one_liner, problem_statement, target_audience, market_size_json, competitors_json, competitor_count, build_complexity, build_timeline, monetization_angle, confidence_score, source_links_json, source_type, created_at

**saved_ideas table** (migration 0003): id, user_id, idea_id, rating, saved_at

**subscriptions table** (migration 0004): user_id, stripe_customer_id, stripe_subscription_id, plan, status, created_at

**rate_limits table** (migration 0004): key, request_count

**New: user_profiles table** (migration 0005): user_id, skills_json, budget_range, niches_json, experience_level, updated_at
