# Feature Research

**Domain:** Adaptive AI-powered language learning — Nigerian languages (Yoruba, Igbo, Hausa)
**Researched:** 2026-03-20
**Confidence:** MEDIUM (WebSearch verified against multiple sources; low-resource language specifics drawn from academic literature)

---

## Context

Mothertongue already has: scenario roleplay, voice I/O, Gemini conversation, reply suggestions, end-of-session evaluation. This document maps what to build next against what the ecosystem expects, what differentiates, and what to deliberately skip.

The target audience is diaspora learners and heritage language reconnectors — people with some cultural familiarity but minimal formal instruction. They arrive on mobile, on variable connections, with high motivation but little time.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Session persistence** | Every other learning app saves your place. Stateless sessions feel like a bug, not a feature. | MEDIUM | Requires auth or anonymous persistent identity + a storage layer. Supabase or similar. Currently absent entirely. |
| **Level progression that reacts to performance** | Duolingo, Babbel, every modern app does this. A hardcoded "beginner" forever is a broken product. | MEDIUM | Inference from conversation quality, not a quiz. The "adaptive" core of the milestone. |
| **Onboarding for total beginners** | Zero-knowledge users will arrive and abandon if there's no guided entry point. | MEDIUM | Must assume zero prior knowledge. First message sets tone and scaffolding depth. |
| **Progress visibility** | Learners need to feel forward motion — time studied, sessions completed, trajectory. Invisible progress kills retention. | LOW-MEDIUM | Can start minimal: session count, current inferred level, recent performance trend. Not a full dashboard. |
| **Audio quality that handles tonal languages** | Yoruba, Igbo, Hausa are tonal. Bad TTS or low-quality audio destroys meaning. Learners notice immediately. | LOW (infra already exists) | Google Cloud TTS already integrated. Must verify Yoruba/Igbo/Hausa voice quality specifically — tone marks matter. |
| **Graceful degradation on poor connections** | Nigerian mobile data is expensive and patchy. A spinner that never resolves = abandonment. | MEDIUM | Timeouts, retry UX, loading states. Not offline-first, but resilient. |
| **Freeform chat mode** | Users who have passed basic scenarios want open practice. A rigid menu of 5 scenarios feels limiting. | MEDIUM | Unstructured chat with the AI partner. Simpler than scenarios but needs context-setting system prompt. |

### Differentiators (Competitive Advantage)

Features that set Mothertongue apart. Not required by convention, but they define the product.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Real-time adaptive difficulty inference** | No quiz, no manual level selection — the AI infers your level from how you respond mid-conversation. This is the core "productive struggle" mechanic. No competitor in Nigerian languages does this. | HIGH | Requires Gemini to evaluate response quality in-flight and adjust system prompt depth, vocabulary ceiling, and scaffolding. The modal inference feature started but is incomplete. |
| **Productive struggle scaffolding** | App deliberately withholds help for 10s+ before offering suggestions. This aligns with Vygotsky's ZPD and neuroplasticity research — learners form stronger memories when they struggle first. | MEDIUM | Already partially built (reply suggestions after silence). Needs to be intentional UX, not accidental. Hint escalation: silence → partial hint → full suggestion. |
| **Multi-Nigerian-language support under one model** | NKENNE covers 13 African languages but with static flashcard content. Mothertongue offers AI conversation in Igbo and Hausa — no app currently provides adaptive AI conversation in these languages at any quality bar. | HIGH | Architecture must be language-agnostic from day one even if only Yoruba launches. Language context is a parameter, not a hardcoded constant. |
| **Cultural scenario grounding** | Learning "how are you" in isolation vs. learning it in a Lagos market scene. Cultural authenticity makes the language feel real, not academic. Competitors default to generic travel scenarios. | MEDIUM | Existing scenarios (market, greetings, transport) are the right instinct. Needs expansion: naming ceremonies, family elder greetings, phone calls, WhatsApp voice notes. |
| **Tone and pronunciation feedback** | Yoruba tone errors change meaning entirely (e.g. àgbàdo = corn, agbado = nothing). Providing feedback on tonal accuracy is a gap no current consumer app fills well for Nigerian languages. | HIGH | Requires either ASR fine-tuned for Yoruba tones or heuristic Gemini prompt evaluation. ASR for Yoruba tones is a known hard problem (57% accuracy in research). Flag as needing deeper feasibility research. |
| **Session continuity across conversations** | Not just saving level — saving conversation history so the AI remembers "last week you struggled with past tense particles" and revisits them. | HIGH | Requires structured memory layer. Likely summarized context passed into Gemini system prompt. Differs from raw session logs. |
| **Zero-to-conversational arc** | A complete learning path from absolute beginner to basic conversational competence, no external materials needed. No Nigerian language app offers this end-to-end. | HIGH | Requires curriculum design embedded in the AI prompting layer: vocabulary gates, grammar concept sequencing, scenario progression logic. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this product.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Manual level selection** | Users want control; feels empowering. | Contradicts the productive struggle philosophy. Learners always self-select comfort. "Beginner" forever. | Adaptive inference replaces this. Onboarding conversation determines starting point automatically. |
| **Leaderboards and social challenges** | Duolingo uses them; users expect them. | Shift motivation to external validation, not genuine learning. Add scope before core learning loop is validated. | Defer entirely. Solo learning arc first. |
| **Gamification (badges, streaks, XP)** | High engagement metric in apps. | Optimizes for habit, not learning. Users game the system (fast taps, skips). Streaks cause anxiety without skill gain. | Show genuine progress: inferred level change, scenarios mastered, vocabulary range. Intrinsic motivation. |
| **Offline mode** | African mobile data is expensive. Users want offline. | Requires downloading model weights or pre-generating all content. Incompatible with adaptive AI conversation — you can't run Gemini offline. | Resilient online UX with graceful degradation. Clear error states. Caching of TTS audio for repeated phrases. |
| **Native mobile app (iOS/Android)** | Users assume apps = native. | Web-first ships faster, reaches more devices (PWA on Android works well). Building native before validating the learning model is premature. | PWA with good mobile web UX. Revisit post-validation. |
| **Full grammar curriculum** | Learners ask for grammar explanations. | Static grammar content is what textbooks do. It competes with the immersive approach and fragments the UX into two different products. | Grammar surfaces in context: AI corrects and briefly explains errors in-flow, not as a separate lesson mode. |
| **Vocabulary drilling (flashcards, SRS)** | Memrise/Anki pattern is well-known. | Isolated vocabulary without context produces weak retention and can't handle tonal languages well. Spaced repetition for Yoruba requires tone-marked audio — a significant build. | Vocabulary encountered in conversation gets reinforced through scenario repetition. Implicit SRS through adaptive scenario selection. |
| **Translation toggle (L1 subtitles always visible)** | Reduces anxiety for anxious learners. | Learners read translations instead of processing L2. Kills immersion. Defeats the productive struggle model. | Translation available as a hint (escalated help), not a default display. User must ask for it. |

---

## Feature Dependencies

```
[Session Persistence]
    └──required by──> [Level Progression]
    └──required by──> [Progress Visibility]
    └──required by──> [Session Continuity / AI Memory]

[Adaptive Difficulty Inference]
    └──required by──> [Level Progression]
    └──required by──> [Zero-to-Conversational Arc]
    └──enhances──> [Productive Struggle Scaffolding]

[Multi-Language Architecture]
    └──required by──> [Igbo Support]
    └──required by──> [Hausa Support]
    └──must exist before──> [Yoruba launch] (architecture, not feature)

[Freeform Chat Mode]
    └──enhances──> [Adaptive Difficulty Inference] (more signal from open conversation)
    └──requires──> [Session Persistence] (context between sessions matters more in freeform)

[Tone/Pronunciation Feedback]
    └──conflicts with──> [Web Speech API] (browser ASR not tuned for tonal languages)
    └──requires──> [Feasibility research] before committing

[Productive Struggle Scaffolding]
    └──enhances──> [Freeform Chat Mode]
    └──enhances──> [Scenario Roleplay] (already partially built)
```

### Dependency Notes

- **Session Persistence is the unblocking dependency**: Level progression, progress visibility, and AI memory all require it. It must land before any of these features are meaningful.
- **Adaptive Difficulty Inference requires Freeform Chat to be fully useful**: Scenarios are constrained; freeform conversation gives richer signal about true learner capability.
- **Multi-language architecture must be a constraint on every build decision from day one**: Even Yoruba-only launch should never hardcode language. The cost of retrofitting is high.
- **Tone/Pronunciation Feedback conflicts with current Web Speech API**: Browser ASR is not trained on tonal Yoruba/Igbo. This feature likely needs a different technical path (Gemini audio evaluation or text-based tone mark checking). Do not design this into v1 without feasibility validation.
- **Productive Struggle Scaffolding and Translation Toggle conflict**: If translation is always visible, productive struggle is impossible. These cannot coexist in the same view.

---

## MVP Definition

### Launch With (v1 — current milestone)

Minimum set to make the adaptive, persistent version of Mothertongue real.

- [x] Scenario-based roleplay — already exists
- [x] Voice I/O — already exists
- [x] Gemini conversation — already exists
- [ ] **Session persistence** — unblocks everything else; zero retention without it
- [ ] **Adaptive difficulty inference** — the core mechanic; hardcoded beginner is broken UX
- [ ] **Onboarding for total beginners** — required to open the funnel to zero-knowledge users
- [ ] **Freeform chat mode** — needed alongside scenarios to show full product vision
- [ ] **Basic progress visibility** — session count, current level, recent trend; motivation layer

### Add After Validation (v1.x)

Features to add once core adaptive loop is proven to work.

- [ ] **Session continuity / AI memory** — triggered when users return multiple sessions and want the AI to "know" them
- [ ] **Cultural scenario expansion** — add naming ceremony, elder greetings, phone call scenarios once core 5 are validated
- [ ] **Igbo language support** — triggered when Yoruba learning model is stable and multi-language architecture is proven
- [ ] **Hausa language support** — follows Igbo

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Tone/pronunciation feedback** — high complexity, requires dedicated feasibility research; ASR for tonal Nigerian languages is an unsolved research problem
- [ ] **Gamification** — streaks, badges, XP; only if intrinsic progress signals prove insufficient for retention
- [ ] **Community/social features** — shared scenarios, peer practice; only after solo learning arc is validated
- [ ] **Native mobile app** — after web product proves the learning model

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Session persistence | HIGH | MEDIUM | P1 |
| Adaptive difficulty inference | HIGH | HIGH | P1 |
| Beginner onboarding | HIGH | MEDIUM | P1 |
| Freeform chat mode | HIGH | MEDIUM | P1 |
| Basic progress visibility | MEDIUM | LOW | P1 |
| Session continuity / AI memory | HIGH | HIGH | P2 |
| Cultural scenario expansion | MEDIUM | MEDIUM | P2 |
| Igbo support | HIGH | HIGH | P2 |
| Hausa support | HIGH | HIGH | P2 |
| Tone/pronunciation feedback | HIGH | VERY HIGH | P3 |
| Gamification | LOW | MEDIUM | P3 |
| Native mobile app | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for this milestone
- P2: Should have, add when Yoruba model is validated
- P3: Future consideration after product-market fit

---

## Competitor Feature Analysis

| Feature | NKENNE | Duolingo (no Yoruba/Igbo/Hausa) | Ling App | Mothertongue Approach |
|---------|--------|----------------------------------|----------|-----------------------|
| Nigerian language support | YES (Yoruba, Igbo, Hausa + 10 others) | NO | Yoruba only | Yoruba first, all 3 target |
| AI conversation | Partial (static curriculum) | YES (but not Nigerian languages) | NO | YES — full Gemini conversation |
| Adaptive difficulty | NO — static flashcard curriculum | YES (well-developed) | NO | YES — real-time inference, no quiz |
| Voice interaction | Limited | YES | NO | YES — primary input method |
| Session persistence | YES | YES | YES | Building now |
| Productive struggle philosophy | NO | Partial (adaptive) | NO | Core design principle |
| Cultural grounding | YES (culture-first) | NO | Minimal | YES — scenario-embedded |
| Tonal language feedback | Minimal | N/A | NO | Aspirational (v2) |
| Offline support | YES | YES | YES | Out of scope (AI-dependent) |

**Key gap Mothertongue fills:** No existing app offers adaptive AI conversation in Yoruba, Igbo, or Hausa. NKENNE is the closest competitor but uses static content. Duolingo doesn't support these languages. The combination of adaptive difficulty + voice conversation + Nigerian language coverage is genuinely differentiated.

---

## African/Low-Resource Language Specific Considerations

### Tonal Language Complexity
Yoruba (3 tones: high, mid, low) and Igbo (2 tones with complex sandhi) are fundamentally different from high-resource languages in what "correct pronunciation" means. Web Speech API and most browser-based ASR are not trained on these tone systems. Research (2025) shows ASR for Yoruba/Igbo achieves ~57% accuracy on tone classification. This is not a solvable problem cheaply — flag as a hard constraint.

**Implication:** Mothertongue must rely on Gemini's text-based evaluation of transliterated responses rather than tone-accurate speech recognition for now. Phonetic accuracy feedback is v2+.

### Data Scarcity
Only ~25% of NLP research on these languages generates new linguistic resources. Training data for Yoruba/Igbo/Hausa AI models is limited compared to Spanish or Mandarin. Gemini's Yoruba quality will be lower than its Spanish quality. The N-ATLaS-LLM (released September 2025) shows progress but Mothertongue should validate Gemini response quality empirically before architecture commits.

**Implication:** Include quality evaluation pass in each language before launch. Don't assume Gemini performs equally across all three languages.

### Connectivity Reality
Nigerian mobile data is expensive relative to income. Average cost of 1GB is a meaningful percentage of monthly income for many users. The product will never be offline-capable (AI-dependent), but must minimize data waste: cache TTS audio for repeated phrases, keep API roundtrips minimal, show meaningful loading states instead of silent failures.

### Diaspora vs. In-Country Learners
Two distinct segments with different constraints:
- **Diaspora (US/UK)**: Good connectivity, motivated by cultural reconnection, likely has some passive knowledge from childhood exposure
- **In-country youth**: Variable connectivity, motivated by prestige/education, may treat it as supplement to formal instruction

Both groups need the productive struggle model, but diaspora users are the more likely early adopters (better connectivity, more discretionary time).

---

## Sources

- [NaijaNLP: A Survey of Nigerian Low-Resource Languages (Feb 2025)](https://arxiv.org/abs/2502.19784)
- [Automatic Speech Recognition for African Low-Resource Languages (2025)](https://arxiv.org/html/2510.01145v1)
- [NKENNE African Language App — Google Play](https://play.google.com/store/apps/details?id=com.triaxo.nkenne&hl=en_US)
- [Duolingo Adaptive Lessons Blog Post](https://blog.duolingo.com/keeping-you-at-the-frontier-of-learning-with-adaptive-lessons/)
- [AI-driven chatbots in second language education — ScienceDirect (2025)](https://www.sciencedirect.com/science/article/pii/S2215039025000086)
- [Bridging Gaps in NLP for Yoruba — arXiv (Feb 2025)](https://arxiv.org/html/2502.17364v1)
- [How AI Is Transforming Language Learning in 2026 — Test Prep Insight](https://testprepinsight.com/resources/how-ai-is-transforming-language-learning-in-2026/)
- [Low Bandwidth LMS for Africa — Vigilearn](https://vigilearn.com/low-bandwidth-lms-africa/)
- [Praktika AI conversational approach — OpenAI](https://openai.com/index/praktika/)
- [The human touch in AI: self-determination theory and scaffolding — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12268064/)

---
*Feature research for: Adaptive Nigerian Language Learning (Mothertongue)*
*Researched: 2026-03-20*
