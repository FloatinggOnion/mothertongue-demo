# Project Research Summary

**Project:** Mothertongue — Adaptive Nigerian Language Learning
**Domain:** AI-powered conversational language learning (low-resource tonal languages)
**Researched:** 2026-03-20
**Confidence:** MEDIUM

## Executive Summary

Mothertongue is an AI conversation partner for learning Nigerian languages (Yoruba, Igbo, Hausa), targeting diaspora and heritage learners. The existing codebase has a strong foundation — Next.js 16 + Gemini + Google Cloud TTS + scenario roleplay + voice I/O — but is stateless and treats every session as a first encounter. The milestone goal is to add persistence, adaptive difficulty inference, freeform chat, and basic progress visibility. No competitor offers adaptive AI conversation in these three languages, which is a genuine and defensible differentiator.

The recommended build path is additive: Neon Postgres + Drizzle ORM for persistence, Better Auth for session identity, and Zustand for ephemeral in-session state. Adaptive difficulty is implemented as a prompt-injection problem — infer level from conversation using Gemini structured output, store it in the database, inject it into the next session's system prompt. No new AI infrastructure is needed. The multi-language architecture (language as a parameter, not a constant) must be enforced from the first database migration even if only Yoruba ships in v1.

The highest risks are not technical: they are about correctness and stability. Yoruba, Igbo, and Hausa are low-resource languages where Gemini's output quality is measurably lower than high-resource languages, and tone diacritic errors produce wrong Yoruba (not just stylistic variation). Concurrently, the existing codebase has a silent fallback in `evaluateConversation()` that returns dummy scores on JSON parse failure — this must be fixed before any adaptive difficulty data is stored, or the entire adaptive loop runs on corrupted inputs. Gemini rate limits will also collapse the conversation loop at low concurrency (4 simultaneous users on Free Tier) and must be addressed before layering in assessment calls.

---

## Key Findings

### Recommended Stack

The core stack (Next.js 16, TypeScript, Gemini, Google Cloud TTS) stays unchanged. The additive layer consists of four libraries: **Neon Serverless Postgres** as the primary database (native Vercel integration via HTTP driver, serverless-safe, generous free tier); **Drizzle ORM** for database access (90% smaller bundle than Prisma, TypeScript-first, no native binary dependencies unlike Prisma's Rust engine); **Better Auth 1.x** for authentication and session management (Auth.js v5 remains perpetually in beta and its team has merged into Better Auth; Better Auth ships a first-party Drizzle adapter and full Next.js App Router support); and **Zustand 5** for ephemeral in-session client state only (not for progress persistence, which belongs in Postgres).

**Core technologies:**
- **Neon Serverless Postgres**: primary database — serverless-safe HTTP driver, native Vercel integration, no connection pooling issues
- **Drizzle ORM 0.45.1**: database access — minimal bundle, TypeScript-first schema, works with Neon's HTTP driver natively
- **Better Auth 1.5.5**: auth + sessions — stable 1.x release, first-party Drizzle adapter, Next.js App Router compatible
- **@neondatabase/serverless 1.0.2**: Neon HTTP/WebSocket driver — required for Vercel serverless functions
- **Zustand 5**: in-session client state only — current level, conversation turns, TTS state; no localStorage persist middleware

### Expected Features

Session persistence is the single unblocking dependency: level progression, progress visibility, and AI memory all require it. It must land before any of these features are meaningful. Adaptive difficulty inference is the core product mechanic — the current hardcoded `'beginner'` is broken UX, not a simplification. Multi-language architecture must be enforced from day one at the schema level even if only Yoruba ships, because retrofitting is expensive.

**Must have (table stakes):**
- Session persistence — every other learning app saves state; stateless sessions feel like a bug
- Adaptive difficulty inference — hardcoded beginner forever breaks the product's core promise
- Beginner onboarding — zero-knowledge users arrive and abandon without a guided entry point
- Freeform chat mode — rigid scenario menus feel limiting; needed to show full product vision
- Basic progress visibility — session count, current level, recent trend; motivation layer

**Should have (competitive differentiators):**
- Productive struggle scaffolding — intentional hint escalation (silence → partial → full suggestion); partially built, needs to be explicit not accidental
- Cultural scenario expansion — naming ceremonies, elder greetings, phone calls; current 5 scenarios are the right instinct but undersized
- Session continuity / AI memory — AI remembers "you struggled with past tense particles"; summarized context in system prompt
- Igbo and Hausa support — after Yoruba learning model is validated

**Defer (v2+):**
- Tone and pronunciation feedback — ASR for tonal Yoruba/Igbo achieves ~57% accuracy; this is an unsolved research problem, not a build problem
- Gamification (badges, streaks, XP) — optimizes for habit, not learning; deferred until intrinsic progress signals prove insufficient
- Native mobile app — web-first ships faster; PWA on Android works well for target audience
- Offline mode — incompatible with AI-dependent conversation

### Architecture Approach

The system uses a three-layer architecture: browser client (React + Zustand for in-session state) → Next.js API layer (route handlers calling a centralized `src/services/gemini.ts`) → external services (Gemini API + Google Cloud TTS). Persistence adds a fourth layer: a Neon Postgres database accessed from API routes via Drizzle ORM, with Better Auth providing user identity. The key architectural constraint is that `language` must be a parameter threaded through every service function and API route from day one, sourced from a central `src/config/languages.ts` registry — never hardcoded inline.

Adaptive difficulty follows Pattern 1 (LLM-as-Judge): every 3-5 user turns, fire-and-forget a Gemini structured output call to `/api/assess` that scores vocabulary range, sentence complexity, and target-language ratio. Results feed a scoring buffer with hysteresis (Pattern 2): level upgrades require 4 of last 5 assessments to agree; downgrades are faster. The session-end flow writes a summary (not full message history) to Postgres. On next session start, the stored `proficiency_level` is injected into the Gemini system prompt, replacing the current hardcoded `'beginner'`.

**Major components:**
1. `src/config/languages.ts` (new) — language registry mapping language codes to TTS voice IDs, prompt fragments, display names
2. `useAdaptiveLevel` hook (new) — scoring buffer with hysteresis; consumes assessment results; never blocks conversation
3. `useProgress` hook (new) — wraps Postgres writes/reads via API routes; session summaries, level history, session count
4. `/api/assess` route (new) — stateless Gemini call for proficiency inference; accepts last 5 user utterances, returns structured level score
5. Better Auth integration — user identity layer; all Postgres rows have a non-nullable `user_id` from day one
6. Neon Postgres schema — `users`, `user_progress` (proficiency level per language), `session_summaries` (capped history)

### Critical Pitfalls

1. **Oscillating adaptive difficulty** — level changes on every turn produce whiplash, not growth. Prevent with a scoring buffer and hysteresis before writing any level-change logic. Require 4/5 consecutive assessments to agree before escalation.

2. **Gemini hallucinating Yoruba/Igbo/Hausa** — low-resource language quality gap is ~24% below high-resource benchmarks. Yoruba without diacritical marks is wrong Yoruba. Include explicit diacritic instruction in every Yoruba system prompt; validate AI output for diacritic presence; inject curated phrases at beginner level.

3. **Proficiency assessment overconfidence** — LLMs trend toward middle scores regardless of actual performance; the existing codebase returns all-5s on JSON parse failure, silently corrupting adaptive data. Fix the silent fallback immediately; use rubric-anchored prompts with behavioral anchors and required `reasoning` field.

4. **Gemini rate limit collapse** — each learner turn triggers up to 4 Gemini calls; Free Tier (15 RPM) is saturated at 4 concurrent users. Implement exponential backoff with jitter; prioritize chat response over assessment calls; cache suggestion results; upgrade to Paid Tier before any user testing.

5. **Auth-before-persistence ordering** — adding persistence without auth orphans all historical data. Every database row must have a non-nullable `user_id`. Auth must be implemented before or concurrent with the first database write — never after.

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Gemini Service Stabilization
**Rationale:** The existing Gemini service has a silent fallback that corrupts evaluation data, single retry with hardcoded 8s sleep, and no error surfacing. Adaptive difficulty adds 1-2 additional Gemini calls per turn. Building on a fragile foundation compounds every subsequent phase. This must be fixed first — it's a pre-condition, not a feature.
**Delivers:** Reliable Gemini integration with exponential backoff, explicit error states, rubric-anchored evaluation prompts with no silent fallbacks, message IDs using `crypto.randomUUID()`, and conversation history capped to prevent memory bloat.
**Addresses:** Rate limit collapse (Pitfall 4), evaluation overconfidence (Pitfall 3), silent dummy scores (technical debt)
**Avoids:** Building adaptive difficulty on corrupted evaluation data

### Phase 2: Auth + Persistence Foundation
**Rationale:** Session persistence is the unblocking dependency for level progression, progress visibility, and AI memory. Auth must be implemented before the first row is written to ensure all data has a stable `user_id`. These two concerns are architecturally inseparable.
**Delivers:** Better Auth integration (email/password + optional anonymous sessions), Neon Postgres schema (`users`, `user_progress`, `session_summaries` tables with `language` column from day one), Drizzle ORM setup, and API routes for reading/writing session data.
**Uses:** Neon Serverless Postgres, Drizzle ORM 0.45.1, Better Auth 1.5.5, `@neondatabase/serverless`
**Avoids:** Orphaned data (Pitfall 5)

### Phase 3: Language Architecture + Yoruba Hardening
**Rationale:** Multi-language parameterization must be enforced before any feature work touches the language layer. The cost of retrofitting `language` from hardcoded string to proper parameter is high. Concurrent with this, Yoruba output quality must be validated empirically — diacritic correctness is a correctness problem, not a polish concern.
**Delivers:** `src/config/languages.ts` language registry, `LanguageCode` type threaded through all service functions and API routes, explicit Yoruba diacritic instructions in all system prompts, validation layer for AI-generated Yoruba output, `LearnerProfile` and `SessionSummary` TypeScript types.
**Addresses:** Gemini hallucinating Yoruba (Pitfall 2), language-specific conditionals anti-pattern

### Phase 4: Adaptive Difficulty
**Rationale:** With stable Gemini calls, valid evaluation data, and persistent storage in place, the adaptive difficulty loop can be built correctly. The scoring algorithm must be designed before any level-change code is written — hysteresis prevents oscillation (Pitfall 1).
**Delivers:** `/api/assess` route with structured Gemini proficiency inference, `useAdaptiveLevel` hook with 5-sample scoring buffer and hysteresis, `proficiency_level` written to `user_progress` after each session, session start reads stored level and injects into system prompt (replacing hardcoded `'beginner'`).
**Implements:** LLM-as-Judge pattern, Scoring Buffer with Hysteresis pattern
**Avoids:** Oscillating difficulty (Pitfall 1)

### Phase 5: Freeform Chat + Progress Visibility
**Rationale:** Once the adaptive loop works in scenarios, freeform chat is a thin layer — a different system prompt without scenario constraints, reusing the same conversation + assessment infrastructure. Progress visibility reads from the persistence layer already built in Phase 2. Both phases are low-risk, high-user-value.
**Delivers:** `/app/chat/page.tsx` freeform chat mode with adaptive difficulty enabled, progress widget on home page (session count, current inferred level, recent performance trend), `useProgress` hook surfacing data to UI.
**Addresses:** Freeform chat (P1 feature), basic progress visibility (P1 feature)

### Phase 6: Productive Struggle Refinement + Beginner Onboarding
**Rationale:** With the core adaptive loop validated, polish the learning mechanics: intentional hint escalation (silence → partial hint → full suggestion), and a guided onboarding path for zero-knowledge users. These build on the working adaptive system.
**Delivers:** Hint escalation as explicit UX (not accidental behavior), onboarding conversation flow for total beginners with automatic starting level inference, translation as escalated hint (not default display).
**Addresses:** Productive struggle scaffolding (differentiator), beginner onboarding (table stakes)

### Phase Ordering Rationale

- **Gemini stabilization before adaptive difficulty** — assessment adds calls per turn; broken retry logic and silent evaluation fallbacks compound directly into corrupted level data.
- **Auth concurrent with persistence** — the pitfalls research is unambiguous: a `user_id` column must exist on every learning data table from the first migration.
- **Language architecture before feature work** — the multi-language constraint is architectural, not a feature. Every PR that touches language after this phase is settled can assume the parameter exists.
- **Adaptive difficulty before freeform chat** — freeform chat's value comes from the adaptive difficulty layer providing richer signal; without it, freeform is just an unstructured chat window.
- **Productive struggle last** — it refines the existing mechanics after the core adaptive loop is proven, not before.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Yoruba Hardening):** Google Cloud TTS `yo-NG` voice availability is unconfirmed. Verify before any TTS integration work targeting Yoruba-native voices. May need graceful degradation to `en-NG` voices.
- **Phase 3 (Yoruba Hardening):** Gemini's actual Yoruba output quality for conversation (vs. translation benchmarks) needs empirical validation. Run a manual QA pass with 20-30 test conversations before building on top of it.
- **Phase 4 (Adaptive Difficulty):** Shared vs. separate adaptive level state for scenarios vs. freeform is an open architectural question. Needs a design decision before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Gemini Stabilization):** Exponential backoff, rubric-anchored prompts, and JSON error handling are well-documented patterns.
- **Phase 2 (Auth + Persistence):** Better Auth + Drizzle + Neon is a documented, template-available stack with official integration guides.
- **Phase 5 (Progress Visibility):** Standard dashboard read pattern from existing Postgres tables.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All version numbers confirmed from npm; Neon + Drizzle + Better Auth patterns verified against official docs and community templates |
| Features | MEDIUM | Table stakes and differentiators well-sourced; Nigerian-language-specific competitor analysis has limited data points; ASR accuracy figures from 2025 academic sources |
| Architecture | MEDIUM | Core patterns (LLM-as-Judge, scoring buffer) are well-established for adaptive learning systems; Nigerian-language-specific data is thin; open question on shared vs. separate level state per mode |
| Pitfalls | MEDIUM-HIGH | Codebase pitfalls are HIGH confidence (direct code analysis); language quality pitfalls HIGH (2025 academic benchmarks); LLM assessment overconfidence MEDIUM (behavioral, not measured in this codebase specifically) |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Google Cloud TTS Yoruba voice availability:** Unconfirmed whether `yo-NG` locale has usable voices. Must be verified before any Yoruba TTS integration. Fallback plan needed.
- **Gemini Yoruba conversation quality (empirical):** Benchmark scores exist but don't measure conversational quality for the specific scenario prompts Mothertongue uses. Run manual QA pass early in Phase 3.
- **Shared vs. separate level state across modes:** Should scenario drills and freeform chat share a single `proficiency_level` per language, or maintain separate levels? Design decision needed before Phase 4.
- **Gemini Paid Tier upgrade path:** Free Tier saturates at 4 concurrent users. The rate limit ceiling for Paid Tier at expected load needs to be checked before user testing.
- **Better Auth anonymous sessions:** The anonymous user plugin needs to be verified for the specific use case of "start learning immediately, link to email later" — confirm migration path from anonymous to registered user preserves historical data.

---

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm) — version 0.45.1
- [Better Auth npm](https://www.npmjs.com/package/better-auth) — version 1.5.5
- [@neondatabase/serverless npm](https://www.npmjs.com/package/@neondatabase/serverless) — version 1.0.2
- [Neon connection pooling docs](https://neon.com/docs/connect/connection-pooling) — HTTP driver behavior
- [Auth.js is now part of Better Auth — GitHub Discussion](https://github.com/nextauthjs/next-auth/discussions/13252) — Auth.js v5 perpetual beta context
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next) — App Router compatibility
- [Gemini structured outputs — ai.google.dev](https://ai.google.dev/gemini-api/docs/structured-output) — responseSchema support
- Codebase analysis: `.planning/codebase/CONCERNS.md` — silent fallbacks, fragile areas, missing test coverage

### Secondary (MEDIUM confidence)
- [NaijaNLP: A Survey of Nigerian Low-Resource Languages (Feb 2025)](https://arxiv.org/abs/2502.19784) — language quality benchmarks, data scarcity
- [Automatic Speech Recognition for African Low-Resource Languages (2025)](https://arxiv.org/html/2510.01145v1) — ASR accuracy figures (~57% for tonal classification)
- [N-ATLaS-LLM: Yoruba, Igbo, Hausa on AfroBench](https://huggingface.co/blog/seun-ajayi/n-atlas-evaluation-report) — Yoruba LLM quality gap data
- [LLM-Powered Automated Assessment: A Systematic Review (2025)](https://www.mdpi.com/2076-3417/15/10/5683) — LLM evaluation overconfidence patterns
- [Duolingo Adaptive Lessons Blog Post](https://blog.duolingo.com/keeping-you-at-the-frontier-of-learning-with-adaptive-lessons/) — adaptive difficulty patterns
- [AI-driven chatbots in second language education — ScienceDirect (2025)](https://www.sciencedirect.com/science/article/pii/S2215039025000086) — productive struggle research
- [Drizzle vs Prisma 2026 — makerkit.dev](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma) — bundle size data, stack recommendations

### Tertiary (LOW confidence)
- [Gemini API Rate Limits: Complete 2026 Guide](https://yingtu.ai/en/blog/gemini-api-rate-limits-explained) — rate limit numbers; needs verification against current Gemini pricing page
- [Vercel Postgres is built on Neon — community.vercel.com](https://community.vercel.com/t/how-to-choose-between-supabase-planetscale-and-neon-for-vercel-projects/36413) — Neon as Vercel's native Postgres (community post)

---
*Research completed: 2026-03-20*
*Ready for roadmap: yes*
