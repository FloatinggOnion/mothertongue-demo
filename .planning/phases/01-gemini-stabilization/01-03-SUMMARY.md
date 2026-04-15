---
phase: 01-gemini-stabilization
plan: "03"
subsystem: error-propagation
tags: [error-handling, ui, feedback, tdd]
dependency_graph:
  requires: ["01-01", "01-02"]
  provides: ["evaluateConversation-throws", "FeedbackCard-error-state", "drill-error-handling"]
  affects: ["src/services/gemini.ts", "src/components/FeedbackCard.tsx", "src/app/drill/[id]/page.tsx", "src/app/api/evaluate/route.ts"]
tech_stack:
  added: []
  patterns: ["discriminated union props", "error propagation", "retry pattern"]
key_files:
  created: []
  modified:
    - src/components/FeedbackCard.tsx
    - src/app/drill/[id]/page.tsx
    - src/app/api/evaluate/route.ts
decisions:
  - "FeedbackCard uses discriminated union (state: success | error) — TypeScript enforces correct prop shapes per state"
  - "fetchEvaluation() extracted as standalone function to support retry button re-invocation"
  - "scenarioId/messageCount hoisted to outer scope in evaluate route so catch block has context for logError()"
metrics:
  duration_minutes: 6
  completed_date: "2026-03-20"
  tasks_completed: 4
  files_modified: 3
---

# Phase 01 Plan 03: Error Propagation and FeedbackCard Error State Summary

**One-liner:** Removed silent all-5s fallback from evaluateConversation(), added discriminated union FeedbackCard with amber error panel and "Retry evaluation" button, wired drill page error handling end-to-end.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Remove fallback from evaluateConversation() + tests | (prior plan) | src/services/gemini.ts, src/services/gemini.test.ts |
| 2 | Refactor FeedbackCard to discriminated union | 60f6f44 | src/components/FeedbackCard.tsx |
| 3 | Update drill page to handle evaluation errors | 1a15c91 | src/app/drill/[id]/page.tsx |
| 4 | Update /api/evaluate route with logError() | b44f484 | src/app/api/evaluate/route.ts |

## What Was Built

- **evaluateConversation()** already threw errors (no fallback) — confirmed by 6 passing tests including two INFRA-01 tests covering JSON parse failure and API errors
- **FeedbackCard** refactored from single-interface to discriminated union: `state: 'success'` renders existing scores/feedback; `state: 'error'` renders amber warning panel with "Retry evaluation" button
- **Drill page** gains `evaluationError` state, extracts `fetchEvaluation()` as a named function (reused by retry), wraps API call with `try/catch` and non-ok response check, conditionally renders FeedbackCard with correct union variant
- **/api/evaluate route** now imports and calls `logError()` with `scenarioId` and `messageCount` context; variables hoisted to outer scope so catch block can access them

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 4 request.json() in catch block would fail (body already consumed)**
- **Found during:** Task 4 implementation
- **Issue:** Plan's suggested `(await request.json().catch(() => ({}))).scenarioId` in the catch block is incorrect — the request body is already consumed by the try block
- **Fix:** Hoisted `scenarioId` and `messageCount` as `let` variables in outer scope, assigned them inside try block after validation; catch block uses the outer-scope variables
- **Files modified:** src/app/api/evaluate/route.ts
- **Commit:** b44f484

### Task 1 Pre-completed

Task 1 (evaluateConversation error propagation + tests) was already implemented and committed in a prior plan execution. Verified with `yarn test` — all 6 tests passed including both INFRA-01 tests. No new commit needed.

## Verification

- `yarn test src/services/gemini.test.ts` — 6/6 passed, including INFRA-01 error propagation tests
- FeedbackCard TypeScript union verified: both `state: 'success'` and `state: 'error'` variants present
- Drill page error handling verified: `evaluationError` state and `state: 'error'` conditional render present
- /api/evaluate logError verified: `logError` call present in catch block with context

## Self-Check: PASSED

All key files exist and all task commits verified present in git history.
