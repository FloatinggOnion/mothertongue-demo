# Roadmap: Mothertongue

## Overview

The build path starts with foundation: stabilize the existing Gemini service before any adaptive logic runs on it, add auth and persistence as a single inseparable unit, then enforce the multi-language architecture and TTS quality bar. Once the foundation is solid, adaptive difficulty closes the core product loop. Freeform chat and progress visibility follow as high-value features that read from the adaptive system. The final phase consolidates UX — warm copy, mobile-first layout, and graceful error states — across all screens.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Gemini Stabilization** ← plans created - Harden the Gemini service before adaptive logic compounds its failures
- [ ] **Phase 2: Auth + Persistence** - User identity and session storage as one inseparable unit
- [ ] **Phase 3: Language Architecture + TTS** - Multi-language parameterization and tone-accurate TTS before any feature work touches the language layer
- [ ] **Phase 4: Adaptive Difficulty** - Close the adaptive learning loop using the stable, persisted foundation
- [ ] **Phase 5: Freeform Chat + Progress** - Open-ended chat mode and progress visibility that read from the adaptive system
- [ ] **Phase 6: Learning UX Polish** - Onboarding, productive struggle mechanics, and warm design consolidated across all screens

## Phase Details

### Phase 1: Gemini Stabilization
**Goal**: The Gemini service is reliable enough to build adaptive difficulty on top of — no silent failures, no corrupted evaluation data, no collision-prone IDs
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. When Gemini evaluation fails to return valid JSON, the app surfaces an explicit error to the user rather than returning all-5s scores silently
  2. When a Gemini API call returns a 429 or transient error, the app retries with exponential backoff and only shows the user an error message after all retries are exhausted
  3. Every message in a conversation has a unique ID that cannot collide with another message in the same session
  4. API routes reject malformed request bodies with a clear error before any processing occurs
**Plans**: 5 plans in 1 wave + 1 setup wave
- [ ] 01-01-PLAN.md — Wave 0: Test infrastructure (vitest, Zod install, gemini.test.ts scaffold)
- [ ] 01-02-PLAN.md — Wave 1: callGemini() exponential backoff + /transcribe refactor (INFRA-02)
- [ ] 01-03-PLAN.md — Wave 1: evaluateConversation() error propagation + FeedbackCard error state (INFRA-01)
- [ ] 01-04-PLAN.md — Wave 1: Message ID UUIDs instead of Date.now() (INFRA-03)
- [ ] 01-05-PLAN.md — Wave 1: API route Zod validation (INFRA-04)

### Phase 2: Auth + Persistence
**Goal**: Users have persistent identities and their session data is saved to a database from the first session — no orphaned data
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, PERS-01, PERS-02, PERS-03
**Success Criteria** (what must be TRUE):
  1. A new user can create an account with email and password and immediately begin a session
  2. A returning user can log in and pick up where they left off — their progress is there
  3. A user can log out from any page and their session is terminated
  4. A user can log in on a different device and see the same history and progress level
  5. At the end of a session, a summary (scenario, level, turn count, scores, date) is saved and the user can view their past sessions
**Plans**: 5 plans in 1 wave + 1 setup wave
- [ ] 01-01-PLAN.md — Wave 0: Test infrastructure (vitest, Zod install, gemini.test.ts scaffold)
- [ ] 01-02-PLAN.md — Wave 1: callGemini() exponential backoff + /transcribe refactor (INFRA-02)
- [ ] 01-03-PLAN.md — Wave 1: evaluateConversation() error propagation + FeedbackCard error state (INFRA-01)
- [ ] 01-04-PLAN.md — Wave 1: Message ID UUIDs instead of Date.now() (INFRA-03)
- [ ] 01-05-PLAN.md — Wave 1: API route Zod validation (INFRA-04)

### Phase 3: Language Architecture + TTS
**Goal**: Language is a first-class runtime parameter throughout the codebase, TTS produces tone-accurate Yoruba speech, and adding a new language requires only a config entry
**Depends on**: Phase 2
**Requirements**: LANG-01, LANG-02, LANG-03, TTS-01, TTS-02, TTS-03, TTS-04, TTS-05
**Success Criteria** (what must be TRUE):
  1. No hardcoded language strings exist in service, API, or hook layers — language flows as a parameter from UI to all downstream calls
  2. The language config registry (`config/languages.ts`) exists and maps language codes to TTS voice IDs, Gemini prompt fragments, and display names
  3. TTS speech for Yoruba is audibly tone-accurate — high/mid/low tones are correctly rendered and the English-accented `en-NG` voice is no longer used for Yoruba instruction
  4. TTS audio is returned within 3 seconds for a typical utterance under normal network conditions
  5. TTS runs as a serverless endpoint outside the Next.js app bundle
**Plans**: 5 plans in 1 wave + 1 setup wave
- [ ] 01-01-PLAN.md — Wave 0: Test infrastructure (vitest, Zod install, gemini.test.ts scaffold)
- [ ] 01-02-PLAN.md — Wave 1: callGemini() exponential backoff + /transcribe refactor (INFRA-02)
- [ ] 01-03-PLAN.md — Wave 1: evaluateConversation() error propagation + FeedbackCard error state (INFRA-01)
- [ ] 01-04-PLAN.md — Wave 1: Message ID UUIDs instead of Date.now() (INFRA-03)
- [ ] 01-05-PLAN.md — Wave 1: API route Zod validation (INFRA-04)

### Phase 4: Adaptive Difficulty
**Goal**: The app infers each learner's proficiency level from their actual responses, persists that level, and uses it to calibrate the AI partner's language on the next turn and in future sessions
**Depends on**: Phase 3
**Requirements**: ADPT-01, ADPT-02, ADPT-03, ADPT-04
**Success Criteria** (what must be TRUE):
  1. A user who speaks confidently for several turns sees the AI partner increase vocabulary complexity and reduce English scaffolding — without any manual level selection
  2. A user who struggles does not experience immediate level drops — the system requires consistent evidence of struggle across multiple assessments before adjusting
  3. When the learner's level changes mid-session, a subtle in-conversation message acknowledges it ("Taking it up a notch" / "Let's ease back in")
  4. The inferred proficiency level from one session is restored at the start of the next session, not reset to beginner
**Plans**: 5 plans in 1 wave + 1 setup wave
- [ ] 01-01-PLAN.md — Wave 0: Test infrastructure (vitest, Zod install, gemini.test.ts scaffold)
- [ ] 01-02-PLAN.md — Wave 1: callGemini() exponential backoff + /transcribe refactor (INFRA-02)
- [ ] 01-03-PLAN.md — Wave 1: evaluateConversation() error propagation + FeedbackCard error state (INFRA-01)
- [ ] 01-04-PLAN.md — Wave 1: Message ID UUIDs instead of Date.now() (INFRA-03)
- [ ] 01-05-PLAN.md — Wave 1: API route Zod validation (INFRA-04)

### Phase 5: Freeform Chat + Progress
**Goal**: Learners can have open-ended conversations outside of structured scenarios, and can see their trajectory — current level, session count, and performance over time
**Depends on**: Phase 4
**Requirements**: LEARN-02, LEARN-03, LEARN-04, PROG-01, PROG-02, PROG-03, PROG-04
**Success Criteria** (what must be TRUE):
  1. A user can start a conversation without selecting a scenario — the freeform chat mode is reachable from the home page and uses the same adaptive difficulty system
  2. During silence in a conversation, help surfaces progressively: a gentle nudge after 10 seconds, a partial hint after another 10, and the full suggestion on a third request — not all at once
  3. AI-generated Yoruba that lacks tone diacritics is rejected and regenerated before being shown to the learner
  4. The home page shows the user's current inferred level, session count, and streak
  5. The user can view a chart or timeline of their level history and a breakdown of scenarios attempted with their best scores
**Plans**: 5 plans in 1 wave + 1 setup wave
- [ ] 01-01-PLAN.md — Wave 0: Test infrastructure (vitest, Zod install, gemini.test.ts scaffold)
- [ ] 01-02-PLAN.md — Wave 1: callGemini() exponential backoff + /transcribe refactor (INFRA-02)
- [ ] 01-03-PLAN.md — Wave 1: evaluateConversation() error propagation + FeedbackCard error state (INFRA-01)
- [ ] 01-04-PLAN.md — Wave 1: Message ID UUIDs instead of Date.now() (INFRA-03)
- [ ] 01-05-PLAN.md — Wave 1: API route Zod validation (INFRA-04)

### Phase 6: Learning UX Polish
**Goal**: Every screen feels warm and conversational, mobile users have a first-class experience, and error states are reassuring rather than technical
**Depends on**: Phase 5
**Requirements**: LEARN-01, UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07
**Success Criteria** (what must be TRUE):
  1. A first-time visitor with zero Yoruba knowledge is guided through an onboarding flow that explains the app's approach and eases them into their first conversation without assuming prior knowledge
  2. All UI copy uses warm, conversational language — a knowledgeable friend's voice, not a formal app's error codes
  3. Evaluation scores and corrections are framed as encouragement — learners feel coached, not graded
  4. The app is fully usable on a mobile phone: microphone button is large and thumb-reachable, no horizontal scroll, conversation view fits small screens
  5. The app handles slow connections gracefully — loading states are visible, content appears progressively, no blank screens

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Gemini Stabilization | 0/? | Not started | - |
| 2. Auth + Persistence | 0/? | Not started | - |
| 3. Language Architecture + TTS | 0/? | Not started | - |
| 4. Adaptive Difficulty | 0/? | Not started | - |
| 5. Freeform Chat + Progress | 0/? | Not started | - |
| 6. Learning UX Polish | 0/? | Not started | - |
