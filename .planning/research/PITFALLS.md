# Pitfalls Research

**Domain:** Adaptive AI conversation language learning — Nigerian low-resource tonal languages (Yoruba, Igbo, Hausa)
**Researched:** 2026-03-20
**Confidence:** MEDIUM-HIGH — codebase pitfalls HIGH (direct analysis); language quality pitfalls HIGH (2025 academic sources); LLM assessment pitfalls MEDIUM

---

## Critical Pitfalls

### Pitfall 1: Adaptive Difficulty That Oscillates Instead of Converges

**What goes wrong:** The difficulty engine fires on every exchange, sending the level up on one good response and immediately down on the next stumble. Learners experience constant whiplash. The "productive struggle" philosophy breaks down when the system cannot hold a difficulty plateau long enough for the learner to actually struggle and grow.

**Why it happens:** Wiring the difficulty signal directly to per-turn correctness with no smoothing window. A single fluent response triggers an upward shift; a single hesitation triggers downward. No inertia, no confidence interval, no minimum dwell time.

**How to avoid:**
- Use a windowed aggregate: require N consecutive above-threshold turns before escalating (e.g., 3 of last 4 turns scored strong)
- Separate the scoring signal (per-turn) from the level-change decision (epoch-level)
- Store a rolling `difficultyMomentum` value — levels only shift when momentum crosses a threshold
- Escalate conservatively (earn it), regress rapidly (prevent frustration)

**Warning signs:** Level field changes on more than 40% of turns. QA sessions with intentional mixed performance show rapid alternation, not plateaus.

**Phase to address:** Adaptive difficulty implementation — define the smoothing algorithm before writing a single line of level-change logic.

---

### Pitfall 2: Gemini Hallucinating Plausible-But-Wrong Yoruba/Igbo/Hausa

**What goes wrong:** Gemini generates responses that look correct — proper-sounding Yoruba words, plausible structure — but contain tone errors, missing diacritics, invented vocabulary, or culturally wrong phrasing. Because the learner has zero proficiency, they cannot detect errors. They learn incorrect language.

**Why it happens:** Yoruba, Igbo, and Hausa are low-resource languages. Benchmarks show Yoruba-to-English scoring 41.3 vs English at 72.1 — a 24% gap. Yoruba's three-level tonal system (acute/grave/macron diacritics) is poorly represented in training data. Gemini commonly drops diacritics without explicit instruction — and Yoruba without correct tone marks is wrong Yoruba.

**How to avoid:**
- For Yoruba: instruct Gemini explicitly in the system prompt to include diacritical marks (à, á, ā). Treat any AI-generated Yoruba with no diacritics as a hallucination signal.
- Add a validation check (regex or secondary Gemini call) that gates responses on diacritic presence
- Keep a curated phrase library for common scenario exchanges and inject known-good phrases at beginner levels
- Ground Gemini with high-quality example sentences per scenario in the system prompt

**Warning signs:** AI returns Yoruba text without any diacritical marks. Same word appears with different spellings within one session. Translation back to English produces incoherent results.

**Phase to address:** Yoruba hardening phase (before any user testing) and multi-language expansion phase.

---

### Pitfall 3: Proficiency Assessment Overconfidence — AI Scores Everyone as Intermediate

**What goes wrong:** The AI evaluator trends toward middle scores (3-4/5) regardless of actual proficiency. A total beginner gets a 3. An intermediate speaker gets a 3. The adaptive system has no gradient and defaults to "intermediate" forever.

**Why it happens:** LLMs demonstrate documented overconfidence patterns and politeness bias. The existing codebase compounds this: `evaluateConversation()` silently returns dummy scores (all 5s) on JSON parse failure — meaning evaluation failures produce the worst possible data for adaptive difficulty invisibly.

**How to avoid:**
- Use a rubric-anchored evaluation prompt with behavioral anchors: "Score 1: learner could not produce a grammatically correct sentence. Score 2: 1-2 correct phrases with significant errors..."
- Require a `reasoning` field in the evaluation JSON — forcing justification improves calibration
- Never silently fall back to default scores. If evaluation fails, surface it explicitly. Remove "all 5s on error" before building anything on top of evaluation.
- Assess four sub-scores separately: vocabulary range, grammar accuracy, comprehension, target-language ratio

**Warning signs:** All scores cluster between 3.0-4.0 regardless of session content. Beginners escalate to intermediate after first session. The catch block in `evaluateConversation()` is ever reached in production.

**Phase to address:** Adaptive difficulty phase — before any session persistence. The scoring model must be validated before scores are stored.

---

### Pitfall 4: Gemini Rate Limits Collapse the Entire Conversation Loop

**What goes wrong:** At even modest concurrent usage (5+ simultaneous learners), the app exhausts Gemini rate limits. The current single-retry-with-8s-hardcoded-sleep means: one 429 blocks the conversation for 8+ seconds, a second 429 on retry produces permanent failure, the turn is lost, and the learner sees silence.

**Why it happens:** Each learner turn triggers up to 4 Gemini calls: chat response + translation + suggestions + proficiency inference. Free Tier is 15 RPM for Flash — 4 concurrent users fully saturates it. The existing `gemini.ts` retry logic has no backoff, and the drill page surfaces no error state.

**How to avoid:**
- Implement exponential backoff with jitter: 2-4s, 8-16s, 32-64s, then fail loudly
- Prioritize: chat response (blocking) > proficiency inference > translation (deferrable) > suggestions (background/cached)
- Cache suggestion results keyed by `scenario + level + lastAiMessageHash` — high repetition, easy win
- Move to Paid Tier before any real user testing
- Surface rate limit failures explicitly to the user

**Warning signs:** Console shows 429 errors during single-user testing. Suggestions appear intermittently. Users report "app freezes" after speaking.

**Phase to address:** Gemini service stabilization — must precede adaptive difficulty since adaptive difficulty adds 1-2 additional calls per turn.

---

### Pitfall 5: Adding Persistence Without Authentication Creates Orphaned Data

**What goes wrong:** Sessions are stored with a device ID or anonymous token. When auth is added later, there is no foreign key linking stored sessions to real user accounts. All historical data is orphaned — unusable for progress tracking, undeletable for compliance. Schema requires redesign with migration while users are active.

**Why it happens:** Persistence feels urgent; auth feels like infrastructure. But every database row written before auth exists has no `user_id`.

**How to avoid:**
- Implement auth before writing a single row of learning data. Even a minimal anonymous user (e.g., Better Auth anonymous user later linked to email) provides a stable UUID from day one.
- Design the schema with `user_id` as a non-nullable foreign key on all learning data tables from the start.
- If auth must be deferred: use a device fingerprint UUID in localStorage as a temporary `user_id`, with a documented migration path.

**Warning signs:** The persistence PR has no `user_id` column in its schema. Database design doesn't explain how rows connect to real user accounts.

**Phase to address:** Auth phase must precede or run concurrent with persistence phase — never after.

---

## Technical Debt to Address Before Building

| Shortcut | Immediate Benefit | Long-term Cost | Verdict |
|----------|-------------------|----------------|---------|
| Silent fallback to dummy evaluation scores | Session doesn't crash | Corrupts all adaptive difficulty data | Remove immediately |
| Hardcoded 'beginner' proficiency level | Simplifies demo | Blocks adaptive difficulty entirely | Remove in first milestone |
| Single `gemini.ts` for all AI calls | Fast to write | Untestable monolith | Split before adaptive difficulty |
| Timestamp-based message IDs (`Date.now()`) | Zero dependencies | ID collisions, React key bugs | Replace with `crypto.randomUUID()` |
| Unbounded in-memory conversation history | Simple | Memory bloat beyond 100 turns | Add cap before session persistence |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Gemini + Yoruba | Omitting diacritic instruction | Explicit system prompt: "Yoruba is tonal. Always include diacritical marks (à á ā). Never omit them." |
| Gemini evaluation | Holistic score without rubric | Behavioral anchors per score level in the prompt |
| Gemini rate limits | Single retry with fixed delay | Exponential backoff with jitter; cache repetitive calls |
| Google Cloud TTS + Yoruba | Assuming voice availability | Verify `yo-NG` locale exists; degrade gracefully if not |
| Web Speech API + Nigerian languages | Assuming browser recognition works | Web Speech API has zero support — always route to Gemini transcription |
| Next.js serverless + concurrent writes | Multiple handlers writing same session row | Append-only event log schema or optimistic locking with `version` field |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase |
|---------|------------------|
| Oscillating adaptive difficulty | Adaptive difficulty implementation |
| Gemini hallucinating Yoruba/Igbo/Hausa | Yoruba hardening + multi-language expansion |
| Evaluation overconfidence | Before storing any scores (adaptive difficulty phase) |
| Rate limit collapse | Gemini service stabilization — before adaptive difficulty |
| Auth-before-persistence ordering | Auth phase must precede or be concurrent with persistence |
| Silent dummy evaluation scores | Gemini service refactor |
| Prompt injection via learner input | API security hardening |

---

## "Looks Done But Isn't" Checklist

- [ ] Adaptive level persists between sessions (survives page reload)
- [ ] Real Gemini evaluation runs in production — "all 5s silent fallback" code path is unreachable
- [ ] All AI-generated Yoruba contains diacritical marks
- [ ] Rate limit failures show explicit error state (not silence)
- [ ] Language code passed explicitly to all Gemini and TTS calls — no hardcoded 'yo' strings in service layer
- [ ] Every stored session has a non-null `user_id`
- [ ] `crypto.randomUUID()` used for all message IDs

---

## Sources

- [NaijaNLP: A Survey of Nigerian Low-Resource Languages (2025)](https://arxiv.org/pdf/2502.19784)
- [The State of LLMs for African Languages (2025)](https://arxiv.org/html/2506.02280v3)
- [N-ATLaS-LLM: Yoruba, Igbo, Hausa on AfroBench](https://huggingface.co/blog/seun-ajayi/n-atlas-evaluation-report)
- [LLM-Powered Automated Assessment: A Systematic Review (2025)](https://www.mdpi.com/2076-3417/15/10/5683)
- [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [Gemini API Rate Limits: Complete 2026 Guide](https://yingtu.ai/en/blog/gemini-api-rate-limits-explained)
- Codebase analysis: `.planning/codebase/CONCERNS.md` — direct identification of silent fallbacks, fragile areas, and missing test coverage

---
*Pitfalls research for: Adaptive Nigerian language learning app (Mothertongue)*
*Researched: 2026-03-20*
