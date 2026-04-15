# Mothertongue

## What This Is

Mothertongue is an adaptive language learning partner for Nigerian languages (Igbo, Yoruba, Hausa). It teaches through interaction — immersive roleplay and freeform conversation — rather than passive study. The core philosophy is productive struggle: learners are pushed just beyond their current level, forced to wrestle before help arrives. Starting with Yoruba, expanding to all three languages.

## Core Value

A learner can sit down with zero knowledge and reach basic conversational ability through natural, AI-driven immersive practice — no textbooks, no drilling vocabulary in isolation.

## Requirements

### Validated

- ✓ Scenario-based conversation framework (market, greetings, food, friends, transport) — existing
- ✓ Voice input via Web Speech API with Gemini transcription fallback — existing
- ✓ AI conversation partner via Gemini (beginner/intermediate/advanced system prompts) — existing
- ✓ Text-to-speech playback via Google Cloud TTS — existing
- ✓ Reply suggestions after 10s silence — existing
- ✓ End-of-session evaluation (fluency, grammar, confidence scores) — existing
- ✓ Yoruba as primary language — existing

### Active

- [ ] Adaptive difficulty that infers learner level from responses in real-time (no manual selection)
- [ ] Dynamic level progression: escalates on strong performance, drops on struggle
- [ ] Full learning arc from zero — onboarding flow that starts total beginners without assumptions
- [ ] Session persistence: save progress, level, and history across sessions
- [ ] Freeform chat mode alongside scenario roleplay
- [ ] Multiple Nigerian language support (Igbo, Hausa) after Yoruba is solid
- [ ] Learner can view their progress and trajectory over time

### Out of Scope

- Social/community features (leaderboards, challenges) — focus on solo learning arc first
- Native mobile app — web-first
- Offline support — requires persistent connectivity for AI inference
- Manual level selection — adaptive inference replaces this
- Gamification (badges, streaks) — v2 only

## Context

The existing demo is a working Next.js app with Gemini + Google Cloud TTS already integrated. The core conversation loop works: user speaks → transcribed → Gemini responds → TTS plays back. Five scenarios exist (Yoruba). Proficiency level is currently hardcoded to 'beginner'. No persistence layer exists — each session is stateless. The modal inference feature (added recently) is incomplete.

Key architecture: `src/services/gemini.ts` handles all AI calls (315 lines, no tests). `src/hooks/useSpeech.ts` manages speech I/O (297 lines). `src/app/drill/[id]/page.tsx` is the main learning UI (428 lines).

## Constraints

- **Tech Stack**: Next.js + TypeScript + Gemini + Google Cloud TTS — stay within existing stack
- **AI**: Gemini API for conversation, evaluation, transcription, suggestions
- **Language**: Yoruba first; architecture must support multi-language from the start
- **Performance**: Gemini rate limits are a real concern — current retry logic handles 429s but caching is absent

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Start with Yoruba only | Validate approach before expanding to all 3 languages | — Pending |
| Adaptive inference over manual level selection | Discomfort philosophy — learner shouldn't opt into comfort | — Pending |
| Productive struggle as core UX pattern | Learning through challenge, not hand-holding | — Pending |
| Web-first | Ship quickly, reach widest audience | — Pending |

---
*Last updated: 2026-03-20 after initialization*
