# Improving End-of-Conversation Scoring — MVP Implementation Guide

## Problem

`evaluateConversation()` in [`src/services/groq.ts`](src/services/groq.ts) (called from
[`POST /api/evaluate`](src/app/api/evaluate/route.ts), triggered by `fetchEvaluation()` in
[`src/app/drill/[id]/page.tsx`](src/app/drill/[id]/page.tsx)) produces scores that don't feel
accurate or consistent. Five concrete causes, in priority order:

1. **The evaluator never sees the user's proficiency level.** `getPartnerResponse()` and
   `getReplySuggestions()` both take `proficiencyLevel`; `evaluateConversation()` doesn't, and
   `EvaluateSchema` doesn't even have the field. So a beginner's simple-but-correct phrases and an
   advanced user's fluent-but-imperfect ones get judged against the same undefined bar.
2. **No rubric, no reasoning before scoring.** The prompt asks for a bare `overallScore` (1–10)
   and three sub-scores (1–100) with no description of what a 40 vs. an 80 means, and nowhere for
   the model to reason before committing to a number. Models asked for a cold number are far less
   calibrated than ones asked to justify it first.
3. **Inconsistent scale, no aggregation rule.** `overallScore` is out of 10, the other three are
   out of 100, and nothing ties them together — the model can (and does) produce `overallScore: 8`
   alongside `fluencyScore: 40`.
4. **`temperature: 0.3`.** Adds unnecessary run-to-run variance to a task that should be
   deterministic-ish: the same transcript should score close to the same way twice.
5. **No signal that user turns are STT transcriptions**, not typed text. Minor
   transcription artifacts (a Yoruba/Hausa speech-to-text engine mishearing a word) currently read
   to the model exactly like a genuine grammar mistake.

This doc is the MVP fix for all five. It's scoped to be a single, mechanical change — no new
services, no new infra, just the existing Groq call done properly.

## Scope

**In scope:**
- Thread `proficiencyLevel` through to the evaluator.
- Rewrite the evaluation prompt with a real rubric, per-level anchors, and reasoning-before-score.
- Compute `overallScore` in code from the three sub-scores instead of asking the model for a
  fourth independent number.
- `temperature: 0`.
- A minimum-content guardrail: don't return a confident score for a conversation with almost no
  user turns.

**Out of scope for this pass** (call out separately if you want them later):
- Surfacing the new per-criterion reasoning in the UI (`FeedbackCard.tsx`) — the MVP just returns
  it in the API response; whether to display it is a separate frontend decision.
- Any change to the live roleplay prompt (`buildPartnerSystemPrompt`) or the mid-conversation
  `SilentEvaluation` type — this is only about the end-of-conversation `Evaluation`.
- Swapping the Groq model — `llama-3.3-70b-versatile` is fine for MVP; revisit only if scoring is
  still inconsistent after the prompt/schema fixes below.

## Step 1 — Add `proficiencyLevel` to the request

**`src/lib/zod-schemas.ts`** — add the field to `EvaluateSchema`:

```ts
export const EvaluateSchema = z.object({
  scenarioId: z.string().min(1, 'scenarioId is required'),
  messages: z.array(MessageSchema).min(1, 'messages array must not be empty'),
  language: z.string().optional(),
  proficiencyLevel: ProficiencyLevelSchema, // new — required, no silent default
});
```

**`src/app/api/evaluate/route.ts`** — destructure it and pass it through:

```ts
const {
  scenarioId: validatedScenarioId,
  messages,
  language,
  proficiencyLevel, // new
} = validationResult.data;

// ...
const evaluation = await evaluateConversation(scenario, messages, language, proficiencyLevel);
```

**`src/app/drill/[id]/page.tsx`** — `fetchEvaluation()` already has `proficiencyLevel` in
component state (used elsewhere in the same file, e.g. for `/api/chat`). Add it to the body:

```ts
body: JSON.stringify({
  scenarioId: scenario.id,
  messages: roleplayHistory(messages).filter((m) => m.id !== 'initial'),
  language: scenario.language,
  proficiencyLevel, // new
}),
```

## Step 2 — Rewrite `evaluateConversation()`

Replace the function in `src/services/groq.ts`. Key changes: `proficiencyLevel` parameter, a real
rubric with per-level anchors, a `reasoning` field per score forcing the model to justify itself
before committing to a number, a note that input is voice-transcribed, and `overallScore` computed
in code rather than requested from the model.

```ts
export async function evaluateConversation(
  scenario: any,
  conversationHistory: Message[],
  language?: string,
  proficiencyLevel: ProficiencyLevel = 'beginner'
): Promise<Evaluation> {
  const activeLang = language || scenario?.language || 'yoruba';
  const langDisplay = activeLang.toLowerCase() === 'hausa' ? 'Hausa' : 'Yoruba';

  const levelRubric: Record<ProficiencyLevel, string> = {
    beginner: `
      This user is a BEGINNER. Judge them against beginner expectations, not native fluency:
      - 80-100: Short, simple, mostly correct phrases; basic vocabulary used appropriately; some
        code-switching to English is expected and NOT a penalty.
      - 50-79: Gets basic meaning across but with frequent grammar slips or heavy reliance on
        English; hesitant but making an honest attempt in ${langDisplay}.
      - 1-49: Little to no usable ${langDisplay}, mostly English, or responses that don't engage
        with the scenario at all.
    `,
    intermediate: `
      This user is INTERMEDIATE. Judge them against a learner building real conversational range:
      - 80-100: Full sentences, appropriate everyday vocabulary, generally correct grammar, only
        occasional English fallback.
      - 50-79: Communicates adequately but grammar is inconsistent, vocabulary is limited/repetitive,
        or sentences are simpler than expected at this level.
      - 1-49: Responses are closer to beginner level than intermediate — heavy English reliance or
        frequent breakdowns in basic sentence structure.
    `,
    advanced: `
      This user is ADVANCED. Judge them against near-native conversational fluency:
      - 80-100: Complex sentences, idiomatic and culturally appropriate language, grammar errors
        are rare and minor, natural pacing and register.
      - 50-79: Solid fluency but noticeable non-native patterns — grammar slips, overly literal
        phrasing, or vocabulary that's correct but not idiomatic.
      - 1-49: Simpler or more error-prone than expected for an advanced learner.
    `,
  };

  const systemPrompt = `
    You are an expert ${langDisplay} language evaluator scoring a learner at the
    "${proficiencyLevel}" level. Only evaluate the "user" turns — the "assistant" turns are the AI
    conversation partner and are not part of the user's performance.

    IMPORTANT: The user's turns are transcribed from spoken audio via speech-to-text. Do not
    penalize likely transcription artifacts (odd spelling, a dropped tone mark, a word that's
    phonetically close to the right one) as if they were grammar mistakes — judge the apparent
    intent, not transcription noise.

    RUBRIC FOR THIS USER'S LEVEL:
    ${levelRubric[proficiencyLevel]}

    For each of fluencyScore, grammarScore, and confidenceScore: first write one short sentence of
    reasoning grounded in a specific moment from the conversation, THEN commit to a 1-100 number
    consistent with that reasoning and the rubric above. Do not pick the number first.

    OUTPUT FORMAT REQUIREMENTS:
    Return exactly one JSON object with this schema:
    {
      "strength": "string (one thing they did well)",
      "strengthExample": "string (a quote from the user demonstrating this strength)",
      "improvement": "string (one area to improve, specific to this conversation)",
      "correctedSentence": "string (a corrected version of one of their actual sentences)",
      "fluencyReasoning": "string (one sentence, grounded in the transcript)",
      "fluencyScore": number (1-100),
      "grammarReasoning": "string (one sentence, grounded in the transcript)",
      "grammarScore": number (1-100),
      "confidenceReasoning": "string (one sentence, grounded in the transcript)",
      "confidenceScore": number (1-100)
    }
  `.trim();

  const messages = [
    { role: 'system', content: systemPrompt },
    ...formatGroqHistory(conversationHistory),
    { role: 'user', content: 'Please evaluate the conversation above.' },
  ];

  try {
    const rawText = await callGroq(messages, { json: true, temperature: 0 });
    const parsed = JSON.parse(rawText || '{}');

    const fluencyScore = Number(parsed.fluencyScore) || 0;
    const grammarScore = Number(parsed.grammarScore) || 0;
    const confidenceScore = Number(parsed.confidenceScore) || 0;

    return {
      strength: parsed.strength || '',
      strengthExample: parsed.strengthExample,
      improvement: parsed.improvement || '',
      correctedSentence: parsed.correctedSentence || '',
      fluencyScore,
      grammarScore,
      confidenceScore,
      // Derived, not model-guessed — keeps it mathematically consistent with the sub-scores.
      overallScore: Math.round((fluencyScore + grammarScore + confidenceScore) / 30),
    };
  } catch (error) {
    console.error('Error evaluating conversation:', error);
    throw error;
  }
}
```

Note `overallScore` is still 1-10 (average of three 1-100 scores, divided by 30 and rounded) — the
`Evaluation` type and `FeedbackCard.tsx` don't need to change.

If you want `fluencyReasoning`/`grammarReasoning`/`confidenceReasoning` available to the frontend
later (e.g. to show "why" under each score), add them to the `Evaluation` interface in
`src/types/index.ts` and pass them through in the return object above — omitted here since it's a
frontend/UI decision, not required for the scoring-accuracy fix itself.

## Step 3 — Minimum-content guardrail

Short conversations (1-2 exchanges) don't have enough signal for a reliable score, but the current
code confidently returns full scores anyway. In `src/app/api/evaluate/route.ts`, after loading
`messages`, add:

```ts
const userTurns = messages.filter((m) => m.role === 'user');
if (userTurns.length < 2) {
  return NextResponse.json(
    { error: 'Not enough conversation yet to evaluate — keep chatting a bit longer.' },
    { status: 400 }
  );
}
```

The drill page's existing `catch` block in `fetchEvaluation()` already handles a non-OK response
via `evaluationError` / `setShowFeedback(true)`, so this surfaces through the existing error UI
with no additional frontend work.

## Step 4 — Tests

There's no existing test file for `evaluateConversation()` — `groq.test.ts` only covers it
implicitly. Add cases mirroring the existing `groq.test.ts` `mockFetchOnce` pattern:
- Same transcript scored at `beginner` vs. `advanced` should not silently ignore the level
  (assert the rubric text for the given level appears in the outgoing system prompt).
- `overallScore` in the returned object equals `Math.round((fluency + grammar + confidence) / 30)`
  for a range of sub-score combinations, not whatever the mocked response's `overallScore` field
  said (prove it's actually derived, not passed through).
- The `/api/evaluate` route returns 400 for a single-user-turn conversation without calling Groq
  at all.

## Verification

No live Groq key is available in this environment to run an end-to-end comparison. Before calling
this done: run the same real conversation transcript through the old and new prompts (temporarily
side by side, or via git stash) and confirm scores are now consistent with the stated
`proficiencyLevel` and don't swing between runs at `temperature: 0`.
