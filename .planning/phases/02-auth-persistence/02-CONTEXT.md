# Phase 2: Auth + Persistence - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

User identity (email/password auth) and session data persistence — delivered as one inseparable unit. Every database row has a non-nullable `user_id` from the first migration. No orphaned session data. Adaptive difficulty, progress visualization, and freeform chat are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Auth + DB Stack
- **Auth library:** Better Auth — TypeScript-first, modern, has first-class email/password support and a Drizzle adapter
- **Database:** Turso (SQLite, edge) — serverless, zero-infra, generous free tier; well-suited for demo/MVP
- **ORM:** Drizzle ORM — lightweight, TypeScript-first, first-class Turso/libSQL support; Better Auth's Drizzle adapter integrates directly

### Auth UX Entry Point
- Dedicated `/login` and `/signup` pages — standalone routes, not modals or inline overlays
- Home page has a "Sign in" link in the nav
- After login or signup, user is redirected to the home page (scenario picker)

### Unauthenticated Access
- Auth is required upfront — no guest sessions, no trial drill before signup
- Unauthenticated users attempting to access drills are redirected to `/login`
- Consistent with the roadmap constraint: `user_id` is non-nullable in all session tables from day one

### Session History Display (PERS-03)
- Past sessions displayed as score cards in a grid layout
- Each card shows: date, scenario name, level (beginner/intermediate/advanced), and fluency/grammar/confidence scores
- Lives on a dedicated `/history` page, linked from the home page nav
- Chronological order (most recent first)

### Claude's Discretion
- Exact card visual design (colors, typography, score display format)
- Navigation component structure (where the sign-in link and history link live exactly)
- Form validation UX details for login/signup (inline errors vs. submit-time errors)
- Session saving mechanism (triggered in existing `/api/evaluate` route or a new `/api/sessions` endpoint)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth requirements
- `.planning/REQUIREMENTS.md` §Authentication — AUTH-01 through AUTH-04: account creation, login persistence, logout, cross-device history
- `.planning/REQUIREMENTS.md` §Persistence — PERS-01 through PERS-03: session summaries saved on end, level persists, history viewable

### Project constraints
- `.planning/PROJECT.md` — Tech stack constraints (Next.js + TypeScript), out-of-scope items, key decisions
- `.planning/ROADMAP.md` §Phase 2 — Success criteria (5 items), phase dependencies

No external specs — requirements are fully captured in decisions above and the REQUIREMENTS.md file.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/zod-schemas.ts` — Zod schemas already in use; extend for auth request bodies (signup/login input validation)
- `src/app/api/evaluate/route.ts` — The evaluate route is the natural trigger point for saving session summaries (PERS-01); evaluation result is already computed here
- `src/components/FeedbackCard.tsx` — End-of-session UI already exists; session save confirmation can surface here

### Established Patterns
- Zod validation on all API routes (from Phase 1, INFRA-04) — auth routes must follow the same pattern
- `src/lib/logger.ts` — Error logging via `logError()` is established; auth failures should use it
- API routes use Next.js App Router conventions (`app/api/*/route.ts`)

### Integration Points
- `src/app/drill/[id]/page.tsx` — Drill page needs to read the authenticated user's level on load (PERS-02: level restores at session start)
- `src/app/page.tsx` — Home page needs auth state to show user status / nav links
- `src/app/api/evaluate/route.ts` — Hook session save here at evaluation completion (PERS-01)
- New routes needed: `/api/auth/[...all]` (Better Auth handler), `/api/sessions` (session save/list), `/history` page, `/login` page, `/signup` page

</code_context>

<specifics>
## Specific Ideas

No specific references — open to standard Better Auth + Drizzle + Turso setup patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-auth-persistence*
*Context gathered: 2026-03-21*
