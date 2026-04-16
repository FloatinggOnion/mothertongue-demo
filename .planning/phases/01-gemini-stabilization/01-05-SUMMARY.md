---
phase: 01-gemini-stabilization
plan: 05
subsystem: api
tags: [zod, validation, typescript, api-routes]

# Dependency graph
requires:
  - phase: 01-gemini-stabilization
    provides: zod dependency added to package.json (Plan 02)
provides:
  - Centralized Zod schemas for all API routes in src/lib/zod-schemas.ts
  - /api/chat validated with ChatSchema — rejects invalid requests with 400
  - /api/evaluate validated with EvaluateSchema — rejects missing/empty fields with 400
affects:
  - 01-06-PLAN (Plans 06 covers /suggestions, /transcribe, /tts validation)
  - future API route development (should import from zod-schemas)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Centralized Zod schemas in src/lib/zod-schemas.ts — all route schemas defined once"
    - "safeParse() + 400 response — validation before any processing"
    - "getZodErrorMessage() helper — consistent field-level error format"

key-files:
  created:
    - src/lib/zod-schemas.ts
  modified:
    - src/app/api/chat/route.ts
    - src/app/api/evaluate/route.ts

key-decisions:
  - "Single centralized zod-schemas.ts file for all 5 route schemas — avoids duplication and ensures consistent validation"
  - "getZodErrorMessage() extracts first Zod issue and formats as 'fieldName message' — matches CONTEXT.md user decision for field-level errors"
  - "Destructure from validationResult.data (not body) — guarantees TypeScript types match Zod schema"

patterns-established:
  - "Validation-first pattern: safeParse() before any DB/API call, return 400 on failure"
  - "Schema colocation: all schemas in one file, imported by routes"

requirements-completed: [INFRA-04]

# Metrics
duration: 15min
completed: 2026-03-20
---

# Phase 01 Plan 05: Zod Request Validation for /api/chat and /api/evaluate Summary

**Centralized Zod schemas in src/lib/zod-schemas.ts with safeParse() validation added to /api/chat and /api/evaluate, returning 400 field-level errors before any Gemini or DB processing**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-20T22:55:00Z
- **Completed:** 2026-03-20T22:10:26Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Created `src/lib/zod-schemas.ts` with ChatSchema, EvaluateSchema, SuggestionsSchema, TtsSchema, and shared MessageSchema/ProficiencyLevelSchema
- Added TypeScript type exports (ChatRequest, EvaluateRequest, SuggestionsRequest, TtsRequest) via `z.infer<>`
- Implemented `getZodErrorMessage()` helper for consistent field-level error formatting
- /api/chat now validates with `ChatSchema.safeParse()` before scenario lookup or Gemini calls
- /api/evaluate now validates with `EvaluateSchema.safeParse()` before evaluateConversation call
- Empty messages array returns `400 { error: "messages Array must not be empty" }` as required

## Task Commits

Each task was committed atomically:

1. **Task 1: Create centralized Zod schema definitions** - `c54ab0e` (feat)
2. **Task 2: Add Zod validation to /api/chat route** - `18ccc24` (feat)
3. **Task 3: Add Zod validation to /api/evaluate route** - `f4097c7` (feat)

## Files Created/Modified
- `src/lib/zod-schemas.ts` - All five API route Zod schemas + type exports + getZodErrorMessage helper
- `src/app/api/chat/route.ts` - Added ChatSchema.safeParse() validation with 400 response on failure
- `src/app/api/evaluate/route.ts` - Added EvaluateSchema.safeParse() validation with 400 response on failure

## Decisions Made
- Used a centralized `zod-schemas.ts` file rather than inline schemas in each route — avoids duplication and provides a single import for Plan 06
- getZodErrorMessage() uses first Zod issue and formats as `field message` — aligns with user decision in CONTEXT.md for field-level error detail

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

**Pre-existing test failures (out of scope):** Running `yarn test` revealed 6 failing tests in `src/services/gemini.test.ts`. These failures are caused by uncommitted changes from Plans 02/03 that are present in the working directory but not committed — specifically a hoisting issue with `var mockGenerateContent = vi.fn()` in vitest, and `evaluateConversation` returning a fallback object instead of throwing. These failures exist independently of Plan 05 changes and have been documented in `deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 06 can immediately import SuggestionsSchema and TtsSchema from `src/lib/zod-schemas.ts`
- /api/chat and /api/evaluate have consistent validation in place
- Blocker: Pre-existing test failures in gemini.test.ts need resolution before test suite can be used as regression guard

---
*Phase: 01-gemini-stabilization*
*Completed: 2026-03-20*
