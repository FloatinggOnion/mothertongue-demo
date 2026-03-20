# Requirements: Mothertongue

**Defined:** 2026-03-20
**Core Value:** A learner can sit down with zero knowledge and reach basic conversational ability through natural, AI-driven immersive practice — no textbooks, no drilling vocabulary in isolation.

## v1 Requirements

### Infrastructure

- [ ] **INFRA-01**: Gemini evaluation failure surfaces an explicit error rather than silently returning default scores (all-5s fallback removed)
- [ ] **INFRA-02**: Gemini API calls retry with exponential backoff (2-4s, 8-16s, 32-64s) before failing with a user-visible error message
- [ ] **INFRA-03**: All message IDs use `crypto.randomUUID()` instead of `Date.now()` to prevent collisions
- [ ] **INFRA-04**: All API route request bodies are validated with Zod before processing

### Authentication

- [ ] **AUTH-01**: User can create an account with email and password
- [ ] **AUTH-02**: User can log in and stay logged in across browser sessions
- [ ] **AUTH-03**: User can log out from any page
- [ ] **AUTH-04**: User's progress and history are accessible from any device after logging in

### Persistence

- [ ] **PERS-01**: Session summaries (scenario, level, turn count, evaluation scores, date) are saved to the database on session end
- [ ] **PERS-02**: User's current inferred proficiency level persists across sessions and is restored at session start
- [ ] **PERS-03**: User can view a history of their past sessions

### Adaptive Difficulty

- [ ] **ADPT-01**: App infers learner proficiency level (beginner/intermediate/advanced) from their responses every 3-5 turns via Gemini assessment — no manual level selection
- [ ] **ADPT-02**: Level only changes when 4 out of 5 recent assessments agree on a new level (scoring buffer prevents oscillation)
- [ ] **ADPT-03**: AI conversation partner adjusts vocabulary, scaffolding depth, and use of English based on the current inferred level
- [ ] **ADPT-04**: Learner sees subtle feedback when their level changes mid-session ("Nice — taking it up a notch" / "Let's ease back in")

### Learning Experience

- [ ] **LEARN-01**: First-time visitors see an onboarding flow that explains the app's approach and eases them into their first conversation without assuming prior knowledge
- [ ] **LEARN-02**: User can start a freeform conversation without selecting a scenario — open-ended chat with the AI partner
- [ ] **LEARN-03**: Help surfaces progressively: 10s silence triggers a gentle nudge, another 10s reveals a partial hint, a third request shows the full suggestion
- [ ] **LEARN-04**: Every AI-generated Yoruba response is validated for diacritical marks before display — responses without tone marks are rejected and regenerated

### Progress

- [ ] **PROG-01**: Home page shows the user's current inferred proficiency level
- [ ] **PROG-02**: Home page shows session count and current streak (consecutive days with at least one session)
- [ ] **PROG-03**: User can see a trajectory view of their level history over time (chart or timeline)
- [ ] **PROG-04**: User can see which scenarios they've attempted and their best performance per scenario

### Text-to-Speech

- [ ] **TTS-01**: Evaluate all available TTS options for Yoruba/Igbo/Hausa — including Meta MMS, fine-tuned open-source models (XTTS, StyleTTS2), and Google Cloud TTS native language voices — and select the best quality option for v1
- [ ] **TTS-02**: TTS engine produces tone-accurate speech for Yoruba (3-level tonal system: high/mid/low) — wrong tones change meaning and cannot be shipped to learners
- [ ] **TTS-03**: TTS runs as a serverless API endpoint (Replicate, Modal, or Hugging Face Spaces) — not bundled into the Next.js app
- [ ] **TTS-04**: Existing Google Cloud TTS integration is replaced or overridden — `en-NG` English-accented voices are not acceptable for Yoruba/Igbo/Hausa instruction
- [ ] **TTS-05**: TTS latency is acceptable for real-time conversation (target: under 3 seconds for a typical utterance)

### Language Architecture

- [ ] **LANG-01**: Language is a runtime parameter throughout the codebase — no hardcoded 'Yoruba' strings in service, API, or hook layers
- [ ] **LANG-02**: A central language config registry (`config/languages.ts`) maps language codes to TTS voice IDs, Gemini prompt fragments, and display names
- [ ] **LANG-03**: Adding a new language (Igbo, Hausa) requires only a config entry — no changes to service logic

### UX & Design

- [ ] **UX-01**: All UI copy is warm and conversational — written as if a knowledgeable friend is talking to the learner, not a formal app
- [ ] **UX-02**: Error states use reassuring, action-oriented language ("Let's try that again" not "Error 500")
- [ ] **UX-03**: Feedback on learner performance (evaluation scores, corrections) is framed as encouragement, not judgment
- [ ] **UX-04**: Visual design uses rounded components, warm color palette, and soft typography that feels welcoming and low-pressure
- [ ] **UX-05**: All screens are fully usable on mobile (touch targets ≥44px, no horizontal scroll, conversation view works on small screens)
- [ ] **UX-06**: Microphone button is the primary CTA on mobile — large, thumb-reachable, with clear recording state indicators
- [ ] **UX-07**: App works well on slow/mobile connections — loading states are visible, partial content shows before full load, no blank screens on delay

## v2 Requirements

### Language Expansion

- **LANG-04**: User can learn Igbo in addition to Yoruba
- **LANG-05**: User can learn Hausa in addition to Yoruba
- **LANG-06**: Language picker on home page allows switching between active languages

### Advanced Learning

- **LEARN-05**: AI remembers key struggles from previous sessions and revisits them ("Last week you had trouble with past tense particles — let's practice")
- **LEARN-06**: Cultural scenario expansion: naming ceremony, elder greetings, phone call, WhatsApp voice note contexts
- **LEARN-07**: Grammar corrections surface in-flow with brief contextual explanation (not a separate lesson mode)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Pronunciation / tone accuracy feedback (ASR) | ASR for tonal Nigerian languages is ~57% accurate — hard research problem, separate from TTS |
| ElevenLabs TTS | Proprietary pricing model; no native Yoruba/Igbo/Hausa support |
| Manual level selection | Contradicts productive struggle philosophy — learners always self-select comfort |
| Gamification (badges, streaks as primary motivation) | Optimizes for habit metrics, not learning. Genuine progress signals replace this. |
| Native mobile app (iOS/Android) | Web-first; PWA on Android covers primary use case |
| Offline mode | AI-dependent — Gemini cannot run offline |
| Flashcard / SRS vocabulary drilling | Context-free vocabulary contradicts immersive approach |
| Always-visible translation subtitles | Kills immersion; translation is a hint, not a default display |
| Social features (leaderboards, peer challenges) | Deferred until solo learning arc is validated |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |
| INFRA-03 | — | Pending |
| INFRA-04 | — | Pending |
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| PERS-01 | — | Pending |
| PERS-02 | — | Pending |
| PERS-03 | — | Pending |
| ADPT-01 | — | Pending |
| ADPT-02 | — | Pending |
| ADPT-03 | — | Pending |
| ADPT-04 | — | Pending |
| LEARN-01 | — | Pending |
| LEARN-02 | — | Pending |
| LEARN-03 | — | Pending |
| LEARN-04 | — | Pending |
| PROG-01 | — | Pending |
| PROG-02 | — | Pending |
| PROG-03 | — | Pending |
| PROG-04 | — | Pending |
| TTS-01 | — | Pending |
| TTS-02 | — | Pending |
| TTS-03 | — | Pending |
| TTS-04 | — | Pending |
| TTS-05 | — | Pending |
| LANG-01 | — | Pending |
| LANG-02 | — | Pending |
| LANG-03 | — | Pending |
| UX-01 | — | Pending |
| UX-02 | — | Pending |
| UX-03 | — | Pending |
| UX-04 | — | Pending |
| UX-05 | — | Pending |
| UX-06 | — | Pending |
| UX-07 | — | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 30 ⚠️

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after initial definition*
