---
phase: 260730-wq7
plan: 01
subsystem: api
tags: [nextjs, groq, zod, roleplay, prompt-engineering]

requires: []
provides:
  - Inline conversation asides — auto-classified + manually-armed side questions that never enter roleplay history
  - Hardened partner system prompt with explicit role-boundary rules and long-history reinforcement
  - Post-generation role-drift self-check with one bounded regeneration retry
affects:
  - Any future work touching src/services/groq.ts, src/app/api/chat/route.ts, or the drill page conversation flow

tech-stack:
  added: []
  patterns:
    - "roleplayHistory()/isRoleplayMessage() in src/lib/conversation.ts — single source of truth for excluding aside-tagged messages from any LLM-facing payload, applied both client-side and defensively server-side"
    - "Two-stage cheap classification (free regex short-circuit, then temperature:0 LLM call) for per-turn intent routing"
    - "Discriminated API response (`kind: 'roleplay' | 'aside'`) with reply/translation kept top-level for backward compatibility"
    - "Heuristic-then-LLM self-check with a hard-capped single retry for drift/quality guards on generated LLM output"

key-files:
  created:
    - src/lib/conversation.ts
    - src/lib/conversation.test.ts
    - src/app/api/chat/route.test.ts
  modified:
    - src/types/index.ts
    - src/lib/zod-schemas.ts
    - src/services/groq.ts
    - src/services/groq.test.ts
    - src/app/api/chat/route.ts
    - src/app/drill/[id]/page.tsx
    - src/components/ConversationView.tsx

key-decisions:
  - "Aside classification happens server-side in /api/chat (not client-side) so the client can optimistically append the user's turn, then retro-tag it by id once the server responds — avoids a second round trip just to classify"
  - "Untagged Message.kind means 'roleplay' (not a new required field) — keeps existing localStorage sessions valid with no version bump"
  - "Aside answers get zero conversationHistory/transcript — the handler is deliberately history-free, which is what actually guarantees the aside never leaks into the roleplay thread, independent of any client-side filtering"
  - "Fail-safe direction for classification is 'roleplay' on any error/ambiguity — a missed aside is recoverable via the manual Ask button; a misrouted roleplay line breaks the scene"
  - "Drift LLM check only fires when the heuristic is clean AND historyLength >= 6, bounding per-turn cost to at most 4 Groq calls in the worst case (classify + drift-check + 1 retry + translate)"

patterns-established:
  - "Server-side defensive filtering: even though the client already excludes asides, src/app/api/chat/route.ts re-applies roleplayHistory() to conversationHistory before it reaches the partner model — client-side filtering is a UX nicety, the server boundary is the actual guarantee"

requirements-completed: [ASIDE-01, ASIDE-02, ASIDE-03, DRIFT-01, DRIFT-02]

duration: ~2h (across two stalled/resumed background executor runs plus manual completion of Task 4's remaining wiring)
completed: 2026-07-31
---

# Quick Task 260730-wq7: Inline conversation asides + role-drift hardening Summary

**Users can now ask an out-of-character side question mid-scenario (auto-detected, or manually armed via an Ask button) without it touching the roleplay's LLM context, and the partner model has an explicit role-boundary prompt plus a one-retry self-check against speaking as the user's character.**

## Accomplishments
- Added a two-stage (regex, then cheap LLM) turn classifier and a history-free aside-answer service, so meta questions like "how do I say tomato?" get a plain-English tutor answer instead of derailing the scene
- `/api/chat` now returns a `kind`-discriminated response and defensively strips aside-tagged messages from `conversationHistory` before it ever reaches the partner model — a server-side guarantee, not just client-side hygiene
- Hardened `buildPartnerSystemPrompt` with an explicit `ROLE BOUNDARY (ABSOLUTE)` block naming the AI's assigned character and forbidding it from ever voicing the user's lines, plus a recency-anchored reinforcement message injected for conversations 6+ turns long
- Added `detectRoleDrift` (heuristic speaker-label/stage-direction detection, escalating to one LLM check on longer histories) wired into `getPartnerResponse` with exactly one bounded regeneration retry
- Drill page: aside bubbles render inline, visually distinct (dashed/muted, labelled "Aside"); an "Ask a side question" toggle works from both Text and Voice input; suggestions, evaluation, and turn metrics are all computed from roleplay-only history
- Fixed a latent bug found in passing: `sendMessage` was sending the newest user turn to Groq twice (once inside `currentHistory`, once as `userMessage`) — now sends only the pre-turn history

## Task Commits

1. **Task 1: Aside contracts + classification and answer services** - `a4141a3` (feat, TDD)
2. **Task 2: Role-drift hardening — prompt rules + post-generation self-check** - `2c040e5` (feat, TDD)
3. **Task 3: /api/chat aside branch with discriminated response** - `715f87e` (feat, TDD)
4. **Task 4: Drill page aside wiring, Ask button, and inline aside bubble** - `49ac47e` (feat)

**Plan metadata:** `8d0a465` (docs: pre-dispatch plan)
**Worktree merge:** `2d6c9b1` (chore: merge quick task worktree, no-ff)

## Files Created/Modified
- `src/lib/conversation.ts` - `isRoleplayMessage`/`roleplayHistory` — single filter used everywhere an outbound LLM payload is built
- `src/services/groq.ts` - `classifyUserTurn`, `getAsideAnswer`, `detectRoleDrift`, hardened `buildPartnerSystemPrompt`, retry-on-drift in `getPartnerResponse`
- `src/app/api/chat/route.ts` - `kind`-discriminated response, `forceAside` override, server-side history sanitization
- `src/app/drill/[id]/page.tsx` - aside state, optimistic tag + retro-tag, Ask button (Text + Voice), roleplay-only payloads throughout
- `src/components/ConversationView.tsx` - dashed/muted `Aside` bubble variant in `MessageBubble`
- `src/types/index.ts`, `src/lib/zod-schemas.ts` - `MessageKind`, optional `kind` on `Message`, optional `forceAside` on `ChatSchema`

## Decisions Made
See `key-decisions` in frontmatter above — all trace directly to the CONTEXT.md decisions gathered before planning (auto-classify-first with manual fallback, inline-but-distinct display, prompt-fix-plus-runtime-self-check for drift).

## Deviations from Plan

None in substance — plan executed as written. Process deviation: the background gsd-executor agent stalled twice (stream watchdog timeouts) and was resumed each time; on the third interruption it hit an account-level monthly spend limit mid-Task-4. Tasks 1–3 were already committed cleanly by the executor. The remainder of Task 4 (fetchSuggestions/fetchEvaluation/metrics filtering and the Ask button UI — the sendMessage rewiring and aside bubble styling were already done by the executor) was completed directly by the orchestrator using the same plan spec, then verified against the plan's exact Task 4 `<verify>` command before committing.

## Issues Encountered
- Merging the executor's worktree branch back into `main` initially failed because unrelated pre-existing uncommitted work (staged deletions of 4 Python service files, part of the user's own in-progress work, untouched by this task) conflicted with git's merge safety check even though the file content was byte-identical between branches. Resolved by stashing (`git stash push -u`), merging, then popping the stash and re-staging the deletions to restore the exact original index state. No user WIP was lost or altered.

## User Setup Required
None — no new environment variables or external service configuration required.

## Next Phase Readiness
Code complete and all automated verification passing (`npx vitest run`: 30/30 tests; `npx tsc --noEmit`: clean; `npm run build`: succeeds). **Task 5 (human browser verification) has not been run** — an agent cannot drive a browser. A human needs to walk through the 9-step verification in `260730-wq7-PLAN.md`'s Task 5 (`npm run dev`, exercise the market-haggling scenario, confirm asides render distinctly and never leak into the AI's context, confirm the seller never voices the buyer's lines over an 8-10 turn conversation) before this is considered fully done.

---
*Quick task: 260730-wq7*
*Completed: 2026-07-31*
