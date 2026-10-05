# Mothertongue web readiness plan

**Scope:** Next.js web app. Yoruba is the first validation cohort; Hausa and Igbo must also be available in the web app. Measure each language separately before making quality claims. Native mobile work follows web validation.

**Product hypothesis:** People who know no Yoruba, a little Yoruba, or some conversational Yoruba can enter a culturally credible conversation, understand what to do next, get useful help without surrendering the turn, and leave knowing what improved.

**Validation goal:** Observe real learners completing that loop and deciding whether it is useful enough to repeat. Model-generated evaluation scores are supporting feedback, not evidence that learning occurred.

## Current evidence (5 October 2026)

- On the live site, the beginner market scenario starts with a mixed-language prompt but gives a zero-knowledge learner no first-step guidance.
- In a live text trial, `I want tomatoes, please.` received `E kú àárọ̀.` after a long warm-up. The reply uses real words but ignores the purchase request and does not advance the market scene. This is one observed failure, not a measured failure rate.
- `Stuck? See suggestions` loaded and then disappeared without visible help or error on two attempts.
- `End Drill` became available after one learner turn, while `/api/evaluate` requires at least two. The resulting error offered retry or exit, with no way to continue.
- Source review shows provider routing is controlled by `LLM_PROVIDER`; the deployed value is not visible from the repo. Gemini's partner prompt includes the scenario description and opener, but not the richer `scenario.context`. The small-model reply gate checks format, repetition, role drift, length, and an English-word ratio; it does not check whether the reply addresses the last learner turn. Gemini returns a generic in-language apology on failure, which can look like a partner reply.
- Local tests: 71/78 passed. Seven speech tests target the previous Google implementation while the routes now use Intron. The local production build could not fetch Google Fonts in the restricted environment; this does not establish a production build defect.

### Local implementation status (not deployed)

- Fixed the short-session End Drill trap: fewer than two learner turns now gets an honest unscored recap, and a failed evaluation can return to the chat.
- Added a first-scene introduction, progressive suggestions that remain editable, visible help errors, and retry/edit recovery for failed partner turns.
- Passed richer scene context to Gemini and Groq, told partners to address the learner's latest meaning, and removed generic in-character apology fallbacks on provider failure.
- Removed the extra model classification call before routine learner turns. Explicit side-question mode and common question patterns still route to a tutor answer. The scenario's configured language now controls partner and suggestion prompts.
- Added a seed conversation set and a controlled English/Yoruba/bilingual prompt comparison protocol. These are research materials; they do not prove coherence yet.
- Added a local reply review that checks the latest learner meaning, scene, speaker role, and target language while supplying the English translation. Gemini, Groq, Morena, and Aya routes retry or fail explicitly on rejected output. This review is itself model-based and still needs blinded testing against human judgments and latency measurements.
- Latest local verification: TypeScript, 97 tests, `git diff --check`, and a network-enabled Next.js production build pass. Full lint remains red from existing issues. The live site still runs the previous deployment; the local reply review has not been tested with its configured Gemini/Groq credentials.
- A four-call Tiny Aya prompt probe using the available Cohere evaluation key is in `evaluation/aya-prompt-probe.md`. Both English and unreviewed Yoruba-draft instructions missed the two-basket price request. This is too small and linguistically unreviewed to select a prompt.
- Added an Igbo scenario filter alongside Yoruba and Hausa. Added optional Clerk account integration: a learner can practice without an account, then sign in or sign up when choosing to save. Saved records are compact scenario summaries in Clerk private metadata; the conversation remains on the current device. The progress page shows saved scenario, language, level, turn count, and number of saved sessions. This implementation has passed TypeScript, 105 tests, focused lint, and a network-enabled production build locally; it has not been deployed or tested against the founder's Clerk instance. Email-code-only access still depends on that instance's settings.

## Phase 1 — Make the existing conversation trustworthy

1. **Capture a reproducible baseline.** Record the deployed provider/model and version, request timings, provider errors, fallback use, and sanitized turn outcomes. Keep secrets and raw learner audio out of logs. Reproduce the market failure across several runs before changing prompts.
2. **Build a conversation evaluation set.** Include 30–50 short multi-turn transcripts across greeting, market, food, friends, and transport. Cover zero-knowledge English and code-switching, basic Yoruba, slightly fluent Yoruba, corrections, ambiguity, and off-topic or side questions. For each learner turn, record the intended meaning and what a valid next reply must address. Have Yoruba speakers review language, register, and cultural fit.
3. **Fix scene continuity.** Pass the full scenario context and a clear conversational objective to the active partner. Explicitly require the next reply to acknowledge or answer the latest learner intent and move the scene one step forward. Do not let brevity constraints reduce a meaningful answer to a greeting. Keep generated replies short enough for speech, but allow a second sentence when needed to remain coherent.
4. **Evaluate model and prompt combinations on the same set.** Compare the current deployed route, Gemini, and any candidate already available in the codebase. Blind-score relevance to the last turn, consistency over multiple turns, Yoruba naturalness, cultural appropriateness, latency, and cost. A fluent-sounding but irrelevant line fails. Choose the provider from these results rather than switching by intuition.
   Compare equivalent English, fluent-speaker-reviewed Yoruba, and bilingual instructions within each provider. Hold scenarios, history, generation settings, and rubric constant. See `evaluation/PROMPT-COMPARISON.md`.
5. **Add a reply quality gate.** Validate nonempty output, role boundary, and semantic relevance to the last turn and scene. Retry once with a targeted repair instruction when relevance fails. If a valid reply still cannot be produced, show an explicit recoverable error; never pass a generic apology off as in-character conversation. Measure the extra latency before enabling any additional model call by default.
6. **Make failures recoverable.** On chat failure, preserve the learner turn and offer retry without duplicating it. On suggestions failure or an empty result, keep the help control and show an actionable message. Prevent overlapping requests and stale replies from appearing after the learner has moved on.

**Gate:** In a reviewed test set, at least 90% of partner turns address the latest learner meaning and remain in scene; no critical role swaps or culturally misleading lines; the live first-turn trial no longer stalls or silently returns a non-answer. Record latency distribution and fallback rate rather than hiding them in an average.

## Phase 2 — Make a first session work for each starting level

1. **Zero knowledge:** Add a short introduction before the first scenario that explains the setting, what the learner can say, and that English is acceptable while starting. Let them try unaided first, then reveal a nudge, a partial phrase, and finally a full example only when requested or after sustained silence. Do not auto-send a suggestion as the learner's answer.
2. **Some knowledge:** Offer a brief starter choice such as `I'm new`, `I know some words`, and `I can hold a short conversation`, or infer it from a lightweight opening exchange. This initial choice is a starting estimate; the app should adjust from observed performance. Resolve the current conflict between manual level locking and the adaptive product vision before implementing this.
3. **Conversation control:** Give every scenario a clear learner objective and a natural completion point. Keep in-character conversation separate from side questions. Allow replay of partner audio and an explicit request for a hint or meaning, with accessible controls on touch and keyboard.
4. **Feedback:** Allow ending at any time, but only offer scored feedback when enough learner turns exist. For a short session, give an honest unscored recap and a way to continue. For longer sessions, show concrete examples and one next step; do not present confidence inferred from text as a precise speech measurement.

**Gate:** In observed sessions, zero-knowledge users can make a first meaningful turn without facilitator help; learners at all three starting levels can complete a scenario and describe what happened and what to try next. No participant is trapped by an end-session or help state.

## Phase 3 — Prove the spoken loop and return value

1. **Speech accuracy:** Test microphone permission, recording, transcription, replay, and TTS on common mobile browsers and variable connections. Compare transcripts with native-speaker recordings, especially tone marks, names, and code-switching. Show the recognized text before it is committed when confidence is low, with a quick edit or retry path.
2. **Voice quality:** Have Yoruba speakers judge pronunciation and tonal accuracy before calling the audio suitable for learning. Treat incorrect tones that change meaning as a release blocker, even when text conversations work.
3. **Accounts and progress:** The founder confirmed optional sign-in at save time, email codes only, and an existing Clerk app. Configure email codes as the only enabled sign-in method in that instance; the prebuilt sign-in UI follows instance settings. Test the real sign-in and return flow with its keys. Compact scenario summaries can live in Clerk private metadata within its 8KB limit. Cross-device transcript resume requires a separate durable store, with a storage and retention decision. Define account deletion and data retention before real-learner recruitment. Avoid streaks or a large dashboard before users say the session itself is useful.
4. **Operational readiness:** Align tests with the active speech provider, add focused end-to-end checks for the first conversation, suggestions, short-session ending, and provider failures. Check build and deployment in an environment with required network access. Define a rollback path for model or prompt changes.

**Gate:** End-to-end voice conversations succeed reliably on the target devices; native speakers approve instructional audio; a learner can return and see useful continuity from the prior session.

## Learner validation study

Recruit **12–18 Yoruba learners**, approximately four to six per starting group: no knowledge, basic words/phrases, and slightly fluent. Include heritage learners and, if they are in the intended audience, learners without Nigerian family background. Do not use team members as the sole participants.

Each participant should: start from the landing page unaided, choose a scenario, complete at least five turns, use help once, try voice if comfortable, and review the end-of-session feedback. Observe where they pause, misunderstand, switch to English, abandon, or ask the facilitator for help. Follow with three questions: `What were you trying to say?`, `Did the partner understand and respond?`, and `Would you use this again to improve your Yoruba? Why?`

Record task completion, relevant-partner-turn rate, help success, time to first meaningful turn, transcription corrections, session abandonment, and a short qualitative account of usefulness and trust. Re-test after fixes with new participants. Do not treat a high satisfaction score or an LLM-generated grade alone as validation.

## Order and decision points

1. Fix the live end-session mismatch and silent suggestion failure.
2. Establish the conversation evaluation set and instrument the deployed route.
3. Repair prompts/context and compare model candidates; pick the backbone with Yoruba-speaker review.
4. Implement the zero-knowledge opening and progressive help.
5. Add accounts and useful saved progress; verify a learner can resume on another device.
6. Validate with real learners; separately evaluate Hausa and Igbo conversation quality before inviting those learners into a formal validation cohort.

**Open decisions:** Confirm whether `validation` means user research, proficiency assessment, or both; whether the first release should optimize for diaspora heritage learners or a broader audience; and whether cross-device transcript resume is needed in the first validation build. The founder confirmed Yoruba-first validation with Igbo and Hausa available, email-code sign-in only when saving, and an existing Clerk app.

## Release checklist for the web validation build

1. **Conversation:** Deployed provider and prompt version recorded; reviewed cases pass the relevance and language gates; a live first-turn request about tomatoes receives a market-relevant answer; p95 latency and failure rate are measured.
2. **First session:** A new learner can start, get a hint, edit a draft, recover from a failed reply, finish a short or full session, and explain the feedback without facilitator help.
3. **Identity and continuity:** Email-code sign-in and sign-up work in the connected Clerk instance; a saved scenario summary and level reappear on another device; account errors preserve the local conversation until save succeeds. Full transcript resume remains a separate decision.
4. **Speech:** Microphone, transcription review, and replay work on target browsers; Yoruba-speaking reviewers accept the instructional audio.
5. **Validation:** 12–18 first learners complete observed sessions across the starting levels. Decisions are based on observed behavior and interviews as well as system metrics.
