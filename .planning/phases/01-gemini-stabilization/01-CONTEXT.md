# Phase 1: Gemini Stabilization - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the Gemini service layer so it is reliable enough to build adaptive difficulty on top of. This phase fixes silent failures, adds retry logic with backoff, replaces collision-prone message IDs, and adds request validation to all API routes. No new user-facing features — only error states and retry indicators are new UI.

</domain>

<decisions>
## Implementation Decisions

### Evaluation error display (INFRA-01)
- Error state rendered inside the existing FeedbackCard component (not a toast or full-screen replacement)
- Error state includes a "Retry evaluation" button — user can re-trigger after transient failure
- When evaluation fails, scores and feedback content are hidden; error message takes their place
- All Gemini/API errors logged to `logs/errors.log` (gitignored) for debugging

### Retry feedback (INFRA-02)
- Show "Retrying... (attempt X of 3)" indicator during exponential backoff so user knows why it's slow
- Error is only shown to user after all retries are exhausted
- Retry scope: ALL Gemini endpoints (/chat, /evaluate, /suggestions, /transcribe) via callGemini() — one change, consistent behavior everywhere
- Backoff intervals per REQUIREMENTS.md: 2–4s, 8–16s, 32–64s

### Validation error verbosity (INFRA-04)
- Field-level Zod error details in 400 responses (e.g. {"error": "text is required"})
- These are internal routes called by the frontend — verbose errors aid development debugging

### Message IDs (INFRA-03)
- Replace Date.now() with crypto.randomUUID() — already prescribed in REQUIREMENTS.md, no ambiguity

### Claude's Discretion
- Exact retry indicator component/placement within the loading state
- Zod schema organization (inline in route file vs shared validation module)
- Log file format (timestamp, endpoint, error message at minimum)
- Error boundary vs try/catch approach for retry indicator state

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — INFRA-01, INFRA-02, INFRA-03, INFRA-04 exact acceptance criteria
- `.planning/ROADMAP.md` — Phase 1 success criteria and dependencies

### No external specs
No external ADRs or design docs — requirements fully captured in decisions above and REQUIREMENTS.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/gemini.ts` `callGemini()`: Existing retry helper (currently only retries once on 429). This is the single place to fix retry logic for all Gemini endpoints.
- `src/components/FeedbackCard.tsx`: Existing component that renders evaluation. Needs error state added — shell is reusable.
- `src/types/index.ts` `Message` interface: Already typed as `id: string` — just change how IDs are generated at call sites.

### Established Patterns
- API routes: POST handler → destructure body → call service → return NextResponse.json()
- Error handling: try/catch at route level, console.error + 500 response (needs upgrading to structured logging)
- Service layer: async functions in `src/services/gemini.ts`, shared `callGemini()` for all Gemini API calls

### Integration Points
- `logs/errors.log` is new — needs to be created and gitignored
- Zod is not yet installed — needs to be added as a dependency
- `crypto.randomUUID()` is available in Next.js 16 edge/Node runtime without imports

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-gemini-stabilization*
*Context gathered: 2026-03-20*
