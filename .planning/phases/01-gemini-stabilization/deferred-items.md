# Deferred Items — Phase 01

## Pre-existing test failures (discovered during Plan 05)

**Source:** `src/services/gemini.test.ts` and `src/services/gemini.ts`

**Status:** Uncommitted working directory changes from Plans 02/03 that were not committed.

**Issue:** The working directory has updated versions of `gemini.ts` (with exported `callGemini`, exponential backoff, `logError` integration) and `gemini.test.ts` (with real test assertions instead of placeholders). However, `@/lib/logger` does not exist yet, and the `vi.mock` hoisting in the test causes test failures.

**Specific failures:**
1. `callGemini is not a function` — mock hoisting issue with `var mockGenerateContent`
2. `evaluateConversation` returns fallback object instead of throwing — pre-existing behavior not matching test expectations

**Root cause:** Plans 02/03 implementation changes were left uncommitted in the working directory.

**Resolution needed:** Plans 02/03 need to be re-run or their changes committed. The `@/lib/logger` module needs to be created.

**Out of scope for:** Plan 05 (Zod validation for /api/chat and /api/evaluate)
