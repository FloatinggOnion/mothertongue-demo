---
phase: 01-gemini-stabilization
plan: "06"
subsystem: api-validation
tags: [validation, zod, api-routes, infra]
dependency_graph:
  requires: [01-05]
  provides: [INFRA-04]
  affects: [suggestions-api, tts-api, transcribe-api]
tech_stack:
  added: []
  patterns: [zod-safeParse, field-level-error-messages]
key_files:
  created: []
  modified:
    - src/app/api/suggestions/route.ts
    - src/app/api/tts/route.ts
    - src/app/api/transcribe/route.ts
decisions:
  - Transcribe route keeps manual validation (FormData not JSON) but uses consistent field-name error format matching Zod routes
metrics:
  duration: 10m
  completed: "2026-03-20"
  tasks: 3
  files: 3
---

# Phase 01 Plan 06: API Request Validation (Part 2) Summary

**One-liner:** Zod validation added to /api/suggestions and /api/tts; /api/transcribe error message normalized — INFRA-04 fully implemented across all five routes.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add Zod validation to /api/suggestions | e7112f6 |
| 2 | Replace manual check with Zod in /api/tts | 17012f3 |
| 3 | Normalize /api/transcribe error format | dd840ac |

## What Was Built

All three remaining API routes now validate request bodies before processing:

- **/api/suggestions** — validates with `SuggestionsSchema.safeParse()`: scenarioId, proficiencyLevel (enum), conversationHistory (array), lastAiMessage (non-empty string)
- **/api/tts** — replaced manual `if (!text)` check with `TtsSchema.safeParse()`: text (required), gender (optional enum)
- **/api/transcribe** — FormData route; kept manual validation but normalized error message from "Audio file is required" to "audio is required" to match Zod format

Combined with Plan 05 (chat and evaluate routes), INFRA-04 is fully satisfied: all five API routes validate request bodies with consistent 400 + field-level error responses before any Gemini or external service calls.

## Verification

- `yarn test`: 6/6 tests pass, no regressions
- Grep checks: all three verification conditions pass

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Files exist:
- src/app/api/suggestions/route.ts — FOUND
- src/app/api/tts/route.ts — FOUND
- src/app/api/transcribe/route.ts — FOUND

Commits exist: e7112f6, 17012f3, dd840ac — all verified via git log.

## Self-Check: PASSED
