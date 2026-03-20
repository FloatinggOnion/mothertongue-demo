---
phase: 01-gemini-stabilization
plan: 02
subsystem: infra
tags: [gemini, retry, backoff, logging, vitest, react]

# Dependency graph
requires:
  - phase: 01-gemini-stabilization
    plan: 01
    provides: vitest infrastructure and test stubs

provides:
  - callGemini() with 3-attempt exponential backoff (2-4s, 8-16s, 32-64s)
  - isRetryable() function — retries 429/502/503, throws immediately on 400/403
  - logError() structured logger writing to logs/errors.log
  - EvaluationLoading component with "Retrying... (attempt X of 3)" indicator
  - /transcribe route routed through callGemini() for retry coverage

affects:
  - all API routes that call callGemini()
  - drill page UX during evaluation
  - Phase 02 (error surface work builds on this retry foundation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - vi.hoisted() for mock function initialization before vi.mock() factories
    - vi.useFakeTimers() + vi.runAllTimersAsync() for testing backoff delays
    - Frontend timer inference for retry attempt UX (no backend signal needed)
    - Shared callGemini() as single retry point — all API routes use it

key-files:
  created:
    - src/lib/logger.ts
    - src/components/EvaluationLoading.tsx
  modified:
    - src/services/gemini.ts
    - src/services/gemini.test.ts
    - src/app/api/transcribe/route.ts
    - src/app/drill/[id]/page.tsx
    - src/components/index.ts
    - vitest.config.ts
    - .gitignore

key-decisions:
  - "vi.hoisted() required to share mock fn references between vi.mock() factory and test body — var/const both fail due to hoisting order"
  - "vi.useFakeTimers() + vi.runAllTimersAsync() needed to test backoff without real 2-64s delays"
  - "Non-retryable errors (400/403) throw immediately — expect(callGemini(...)).rejects pattern works without fake timer advance"
  - "evaluateConversation() now throws instead of catching — callers responsible for error handling (INFRA-01 requirement)"
  - "EvaluationLoading uses frontend timer inference aligned to backoff windows (no backend signal needed)"
  - "logError() is fire-and-forget (non-blocking async) — logging failures do not break request handling"

patterns-established:
  - "Pattern: All Gemini API calls route through callGemini() — retry logic is centralized, not duplicated per route"
  - "Pattern: vi.hoisted() for shared mock state in vitest with ESM module mocking"

requirements-completed:
  - INFRA-02

# Metrics
duration: 26min
completed: 2026-03-20
---

# Phase 01 Plan 02: Gemini Stabilization — Retry Logic Summary

**callGemini() with 3-attempt exponential backoff (2-4s/8-16s/32-64s), logError() structured file logger, EvaluationLoading retry indicator, and /transcribe refactored for INFRA-02 retry coverage**

## Performance

- **Duration:** 26 min
- **Started:** 2026-03-20T21:57:18Z
- **Completed:** 2026-03-20T22:23:23Z
- **Tasks:** 6
- **Files modified:** 8

## Accomplishments

- callGemini() now retries up to 3 times on 429/502/503 with jittered exponential backoff per REQUIREMENTS.md windows
- /transcribe route refactored from direct GoogleGenAI SDK usage to callGemini() — INFRA-02 coverage complete across all routes
- logError() appends structured entries to logs/errors.log with timestamp, endpoint, attempt number, and status code
- EvaluationLoading component shows "Evaluating..." then "Retrying... (attempt X of 3)" at 3s/10s/20s thresholds
- Drill page integrates EvaluationLoading via isEvaluating state during /api/evaluate fetch
- Locked decision from CONTEXT.md implemented: "Show 'Retrying... (attempt X of 3)' indicator during exponential backoff"

## Task Commits

1. **Task 1: Implement callGemini() retry logic (TDD)** - `ebf65c0` (feat + test)
2. **Task 2: Refactor /transcribe to use callGemini()** - `ca25c18` (feat)
3. **Task 3: Add /logs/ to .gitignore** - `540e8cd` (chore)
4. **Task 4: Error logging** - included in `ebf65c0` (logError imported and called in catch block)
5. **Task 5: Create EvaluationLoading component** - `e0a9395` (feat)
6. **Task 6: Update drill page with EvaluationLoading** - `8d4e9cf` (feat)

## Files Created/Modified

- `src/services/gemini.ts` - Rewrote callGemini() with 3-attempt retry loop; removed catch from evaluateConversation(); exported callGemini
- `src/services/gemini.test.ts` - Implemented 6 real tests using vi.hoisted() and vi.useFakeTimers() for backoff testing
- `src/lib/logger.ts` - Created logError() — non-blocking fs.appendFile to logs/errors.log with mkdir guard
- `src/app/api/transcribe/route.ts` - Removed local GoogleGenAI instantiation; now calls callGemini()
- `src/components/EvaluationLoading.tsx` - New loading modal with frontend timer-based retry attempt counter
- `src/app/drill/[id]/page.tsx` - Added isEvaluating state; shows EvaluationLoading during evaluation fetch
- `src/components/index.ts` - Added EvaluationLoading to barrel export
- `vitest.config.ts` - Added path alias @ → ./src for module resolution in tests
- `.gitignore` - Added /logs/ entry

## Decisions Made

- Used `vi.hoisted()` to make mock functions available inside `vi.mock()` factories — ESM hoisting makes const/var declarations unavailable in factory scope otherwise
- Used `vi.useFakeTimers()` + `vi.runAllTimersAsync()` to skip real backoff delays in tests (would take up to 64s per test run)
- Non-retryable error tests (400/403) don't need timer advance — they throw synchronously within the promise microtask queue
- `evaluateConversation()` now propagates errors instead of catching them — the API route layer handles user-facing error responses

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added path alias to vitest.config.ts**
- **Found during:** Task 1 (writing tests)
- **Issue:** `@/services/gemini` import failed in tests — vitest had no `@/` alias configured
- **Fix:** Added `resolve.alias` with `path.resolve(__dirname, './src')` to vitest.config.ts
- **Files modified:** vitest.config.ts
- **Verification:** Tests ran successfully after fix
- **Committed in:** `ebf65c0` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed vi.mock() hoisting with vi.hoisted()**
- **Found during:** Task 1 (TDD RED phase — 6 different approaches tried)
- **Issue:** `const mockGenerateContent = vi.fn()` was not accessible inside `vi.mock()` factory because vitest hoists factory before module declarations
- **Fix:** Used `vi.hoisted()` API which runs before factory, correctly sharing the fn reference
- **Files modified:** src/services/gemini.test.ts
- **Verification:** All 6 tests pass cleanly with no unhandled rejections
- **Committed in:** `ebf65c0` (Task 1 commit)

**3. [Rule 1 - Bug] Fixed unhandled rejection errors in 400/403 tests**
- **Found during:** Task 1 (GREEN phase — tests passed but 4 unhandled rejections)
- **Issue:** `await vi.runAllTimersAsync()` advanced the event loop, causing promise rejection before `expect(...).rejects` registered its handler
- **Fix:** Non-retryable tests use direct `expect(callGemini(...)).rejects` pattern without timer advance — they throw immediately
- **Files modified:** src/services/gemini.test.ts
- **Verification:** Test suite shows "6 passed" with no error count
- **Committed in:** `ebf65c0` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All auto-fixes required for test infrastructure to work. No scope creep.

## Issues Encountered

The TDD RED phase required 8+ mock attempts due to vitest's ESM hoisting behavior. The `vi.hoisted()` API (vitest-specific) was the correct solution — not documented prominently but designed exactly for this pattern.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- INFRA-02 complete: all API routes (chat, evaluate, transcribe, suggestions) retry on transient failures
- INFRA-01 partial: evaluateConversation() now throws — API error surface work (Plan 03) can build on this
- EvaluationLoading component ready for real-world validation during slow Gemini responses
- logs/errors.log will accumulate on first API error — useful for debugging

---
*Phase: 01-gemini-stabilization*
*Completed: 2026-03-20*
