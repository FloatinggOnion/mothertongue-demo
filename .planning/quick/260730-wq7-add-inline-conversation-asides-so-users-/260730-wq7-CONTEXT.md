# Quick Task 260730-wq7: Inline conversation asides + role-drift hardening - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning

<domain>
## Task Boundary

Two related fixes to the roleplay drill experience in mothertongue-demo (Next.js), scoped to `src/app/drill/[id]/page.tsx`, `src/services/groq.ts`, `src/app/api/chat/route.ts`, and related components/types:

1. **Conversation asides ("mini-branches"):** While mid-scenario, the user should be able to ask a quick throwaway side-question (e.g. "wait, how do I say X?") and get an answer, without that exchange becoming part of the roleplay's `conversationHistory` sent to the LLM. After the aside, the main scenario conversation resumes exactly where it left off — the AI partner has no memory of the aside.
2. **Role-drift hardening:** The scenario system prompt (`buildPartnerSystemPrompt` in `src/services/groq.ts`) currently only says "stay in character" and does not explicitly forbid the model from generating the user's side of the dialogue. Over longer conversations the model sometimes drifts and starts speaking as the user's character (e.g. becomes the buyer in a market-haggling scenario instead of staying the seller). Needs a fix that reduces this drift.

Flutter app (`mothertongue_app`) is explicitly OUT of scope — its drill screen is a fully mocked stub (fake `Future.delayed` calls, no real API), so neither fix applies there.

</domain>

<decisions>
## Implementation Decisions

### Aside trigger
- Primary method: infer intent from the user's own message/speech. When the user sends a turn, first classify whether it's an in-character roleplay reply or an out-of-character aside question (e.g. "how do you say X", "what does Y mean", "wait what's the word for..."). If classified as an aside, route it to a separate handler instead of the roleplay partner.
- Fallback: a dedicated "ask" button/icon near the input that the user can tap to manually force aside mode for their next message, for when the automatic inference misses it (e.g. ambiguous or the classifier is unsure).
- The classification step should be cheap/fast (small/targeted LLM call or heuristic — implementer's choice) since it runs on every turn.

### Aside display & resume
- Asides appear **inline in the scrolling transcript**, not in a separate popover — user can scroll back and see they asked it.
- Styled **visually distinct** from real in-scenario dialogue bubbles (e.g. muted color/dashed border/small "aside" label) so it's unmistakably not part of the roleplay.
- Asides are **excluded from `conversationHistory`** sent to `/api/chat` — the AI partner must have zero awareness the aside happened. Resuming is implicit: the very next real message continues the scenario using only the pre-aside history.
- Aside answers should be given in a way useful for a language learner (plain-language explanation, likely including the target-language phrase), not in character.

### Role-drift fix
- Two layers, both required:
  1. **Prompt hardening** — add explicit rules to `buildPartnerSystemPrompt` that forbid the model from ever generating dialogue, narration, or actions for the user's character, and reinforce the assigned role/character boundary (who the user is vs. who the AI is) more explicitly than the current "stay in character" line. Consider periodic reinforcement for longer histories if easy to do without a redesign.
  2. **Runtime self-check** — after generating a roleplay reply, run a lightweight check that detects if the reply looks like it's voicing the user's role/side (e.g. speaking for the user's character, addressing the AI's own character in 2nd person as if the user said it, etc.) and retries generation once if so. Keep this cheap — a small classification/heuristic pass, not a full re-evaluation pipeline.

</decisions>

<specifics>
## Specific Ideas

- Existing scenario config lives in `src/config/scenarios.ts` (10 scenarios across Yoruba/Hausa, each with `aiRole`, `context`, `starterPrompt`, etc.) — role-drift fix should generalize across all of them, not just market-haggling.
- `/api/chat/route.ts` is currently stateless — client sends full `conversationHistory` each call. This makes excluding asides from history straightforward: simply don't append aside Q&A to the `messages` state array that feeds `conversationHistory`, or keep asides in a separate array/flag so they're filtered out before being sent.
- `ConversationView.tsx` / `MessageBubble` already has a pattern for rendering message variants (hover-reveal translations) — the aside bubble styling should follow the existing design system (`design.md`, CSS vars like `--color-*`) rather than introducing new ad hoc styles.

[No further specifics — open to standard approaches for the classifier implementation, self-check heuristic, and exact visual treatment within existing design tokens.]

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above. Existing code already read and understood: `src/services/groq.ts`, `src/app/api/chat/route.ts`, `src/app/drill/[id]/page.tsx`, `src/components/ConversationView.tsx`, `src/config/scenarios.ts`.

</canonical_refs>
