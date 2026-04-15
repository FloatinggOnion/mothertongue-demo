# Architecture Research

**Domain:** Adaptive conversational language learning (AI-driven, Nigerian languages)
**Researched:** 2026-03-20
**Confidence:** MEDIUM — core patterns are well-established; Nigerian-language-specific data is thin

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Client)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │  Drill Page  │  │  Chat Page   │  │       Home / Onboarding   │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────────────────┘  │
│         │                 │                                           │
│  ┌──────▼─────────────────▼────────────────────────────────────┐    │
│  │                   Learner State Layer                         │    │
│  │  useAdaptiveLevel  │  useProgress  │  useSessionHistory       │    │
│  └──────┬─────────────────────────────────────────┬────────────┘    │
│         │  (reads/writes)                          │ (persists)       │
│  ┌──────▼──────────┐                    ┌──────────▼───────────┐    │
│  │  React useState  │                    │  localStorage Store   │    │
│  │  (session-live)  │                    │  (cross-session)      │    │
│  └──────────────────┘                    └──────────────────────┘    │
└────────────────────────┬────────────────────────────────────────────┘
                         │ fetch()
┌────────────────────────▼────────────────────────────────────────────┐
│                    NEXT.JS API LAYER (Server)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │  /chat   │  │ /assess  │  │  /eval   │  │  /tts /transcribe│    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘    │
│       │              │             │                   │              │
│  ┌────▼──────────────▼─────────────▼───────────────────▼──────────┐ │
│  │                    src/services/gemini.ts                        │ │
│  │   getPartnerResponse  │  assessProficiency  │  evaluateSession   │ │
│  │   getReplySuggestions │  translateText                           │ │
│  └────────────────────┬───────────────────────────────────────────┘ │
└───────────────────────┼─────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                                  │
│  ┌──────────────────────┐        ┌──────────────────────────────┐   │
│  │   Google Gemini API  │        │   Google Cloud TTS           │   │
│  │  (conversation,      │        │  (language-aware voice       │   │
│  │   assessment, eval,  │        │   synthesis)                 │   │
│  │   translation)       │        └──────────────────────────────┘   │
│  └──────────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `useAdaptiveLevel` | Track current inferred level, expose level-change events | Client hook with scoring buffer |
| `useProgress` | Cross-session progress persistence (level history, sessions completed) | Wraps localStorage with typed schema |
| `useSessionHistory` | Current session messages and metrics | React state, serialized to localStorage on session end |
| `/api/assess` (new) | Stateless Gemini call that infers proficiency from recent turns | POST route, returns `{ level, confidence, rationale }` |
| `src/services/gemini.ts` | All Gemini interactions, language-parameterized | Extend with language param thread-through |
| `src/config/languages.ts` (new) | Language registry: supported languages, TTS voice IDs, CEFR-equivalent descriptors | Static config, language-keyed |

---

## Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # existing — extend with language param
│   │   ├── assess/route.ts        # NEW — proficiency inference endpoint
│   │   ├── evaluate/route.ts      # existing
│   │   ├── tts/route.ts           # existing — extend with language-aware voice
│   │   ├── transcribe/route.ts    # existing
│   │   └── suggestions/route.ts   # existing
│   ├── drill/[id]/page.tsx        # existing — wire useAdaptiveLevel
│   ├── chat/page.tsx              # NEW — freeform mode entry
│   └── page.tsx                   # existing — add progress summary widget
├── config/
│   ├── scenarios.ts               # existing
│   └── languages.ts               # NEW — language registry
├── hooks/
│   ├── useSpeech.ts               # existing
│   ├── useAdaptiveLevel.ts        # NEW — level inference + escalation logic
│   └── useProgress.ts             # NEW — localStorage persistence layer
├── services/
│   └── gemini.ts                  # existing — add language param, assessProficiency()
└── types/
    └── index.ts                   # existing — extend with LearnerProfile, LanguageCode
```

---

## Architectural Patterns

### Pattern 1: LLM-as-Judge for Proficiency Inference

**What:** After every 3-5 user turns, send the last N user utterances to a separate Gemini call that scores them on vocabulary range, sentence complexity, and target-language ratio. Returns a discrete confidence score per level.

**When to use:** Always — reuses existing Gemini infrastructure, runs out-of-band, produces a signal that feeds a scoring buffer.

**Trade-offs:** Adds one Gemini call every 3-5 turns. Fire-and-forget from client (never blocks conversation turn).

**Example:**
```typescript
// /api/assess POST handler (new)
// Input: { userUtterances: string[], language: LanguageCode }
// Output: { level: ProficiencyLevel, confidence: number, rationale: string }

const assessmentPrompt = `
You are assessing a learner's ${language} proficiency from their recent utterances.
Score each dimension 1-3 (1=beginner, 2=intermediate, 3=advanced):
- vocabulary: range and appropriateness of word choice
- complexity: sentence length and grammatical structure
- target_language_ratio: proportion of Yoruba vs English

Return JSON: { "vocabulary": 1, "complexity": 2, "target_language_ratio": 1, "level": "beginner", "confidence": 0.8 }

Utterances to assess:
${userUtterances.map((u, i) => `${i + 1}. "${u}"`).join('\n')}
`;
```

### Pattern 2: Scoring Buffer with Hysteresis

**What:** Never change level on a single assessment. Maintain a rolling buffer of the last 5 scores. Level upgrades when 4/5 scores agree on higher; downgrades when 4/5 agree on lower.

**Example:**
```typescript
// useAdaptiveLevel.ts (simplified)
function shouldChangeLevel(buffer: ProficiencyLevel[], proposed: ProficiencyLevel): boolean {
  const threshold = 4; // out of 5
  const count = buffer.filter(l => l === proposed).length;
  return count >= threshold;
}
```

### Pattern 3: Parameterized Language Thread-Through

**What:** Every service function and API route accepts `language: LanguageCode`. A central language registry maps codes to TTS voice IDs, prompt fragments, display names. No inline language-specific strings.

**Example:**
```typescript
// config/languages.ts
export const LANGUAGE_CONFIG = {
  yoruba: {
    code: 'yo',
    displayName: 'Yoruba',
    ttsVoiceMale: 'yo-NG-Standard-A',   // confirm availability
    ttsVoiceFemale: 'yo-NG-Standard-B',
    partnerPromptFragment: 'Yoruba, as spoken in Nigeria',
    evaluatorContext: 'West African Yoruba language',
  },
  igbo: { code: 'ig', displayName: 'Igbo' },
  hausa: { code: 'ha', displayName: 'Hausa' },
} as const;

export type LanguageCode = keyof typeof LANGUAGE_CONFIG;
```

### Pattern 4: localStorage as Primary Persistence

**What:** All learner state lives in localStorage under a versioned schema key (`mothertongue_v1`). Store only session summaries, not full message arrays (5MB origin cap).

**Example:**
```typescript
interface LearnerProfile {
  schemaVersion: 1;
  language: LanguageCode;
  currentLevel: ProficiencyLevel;
  levelHistory: Array<{ level: ProficiencyLevel; timestamp: number }>;
  sessionsCompleted: number;
  totalTurns: number;
  lastSessionAt: number | null;
  recentSessionSummaries: SessionSummary[]; // last 10, capped
}

const STORAGE_KEY = 'mothertongue_v1';
```

---

## Data Flow

### Conversation Turn with Adaptive Assessment

```
User speaks
    ↓
useSpeech → POST /api/transcribe → transcription
    ↓
Drill page appends userMessage to messages[]
    ↓
POST /api/chat { scenarioId, language, proficiencyLevel, conversationHistory }
    ↓
AI reply returned → TTS playback
    ↓
[every 3-5 user turns, fire-and-forget]:
POST /api/assess { userUtterances: last5UserMessages, language }
    ↓
useAdaptiveLevel.addSample(level) → buffer evaluation
    ↓
[if buffer threshold met] → currentLevel updates → next chat uses new level
```

### Session End and Persistence

```
User taps "End Drill"
    ↓
POST /api/evaluate → FeedbackCard displayed
    ↓
useProgress.saveSession({ evaluation, level, turns, scenarioId, language })
    ↓
localStorage['mothertongue_v1'] updated
    ↓
Home page reads useProgress → shows progress widget
```

---

## Build Order

1. **Types extension** — `LanguageCode`, `LearnerProfile`, `SessionSummary` in `src/types/index.ts`
2. **Language config** — `src/config/languages.ts`
3. **`useProgress` hook** — localStorage persistence, testable in isolation
4. **`assessProficiency()` + `/api/assess`** — curl-testable independently
5. **`useAdaptiveLevel` hook** — scoring buffer, depends on step 4
6. **Wire into drill page** — replace hardcoded `'beginner'`
7. **Home page progress widget** — reads `useProgress`
8. **Freeform chat mode** — thin reuse of existing loop without scenario
9. **Multi-language UI** — language picker threads `LanguageCode` through all flows

---

## Anti-Patterns

- **Assessing on every turn** — doubles API volume, produces noisy signal. Assess every 3-5 turns instead.
- **Language-specific conditionals** — `if (language === 'yoruba')` scattered through code. Use config lookups.
- **Storing full conversation in localStorage** — hits 5MB cap. Store summaries only.
- **Blocking chat response on assessment** — adds 1-3s stall. Always fire-and-forget.

---

## Open Questions

1. Does Google Cloud TTS have usable `yo-NG` voices? Existing TTS uses `en-NG` voices — native Yoruba TTS may be limited.
2. Gemini API rate limit with assessment calls? Assessment doubles call volume per user.
3. Should freeform chat share the same adaptive level state as scenario drills, or maintain separate levels per mode?

---

*Architecture research for: Mothertongue adaptive language learning system*
*Researched: 2026-03-20*
