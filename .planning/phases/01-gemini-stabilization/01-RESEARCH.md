# Phase 1: Gemini Stabilization - Research

**Researched:** 2026-03-20
**Domain:** Next.js API hardening — retry logic, input validation, structured logging, ID generation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Evaluation error display (INFRA-01)**
- Error state rendered inside the existing FeedbackCard component (not a toast or full-screen replacement)
- Error state includes a "Retry evaluation" button — user can re-trigger after transient failure
- When evaluation fails, scores and feedback content are hidden; error message takes their place
- All Gemini/API errors logged to `logs/errors.log` (gitignored) for debugging

**Retry feedback (INFRA-02)**
- Show "Retrying... (attempt X of 3)" indicator during exponential backoff so user knows why it's slow
- Error is only shown to user after all retries are exhausted
- Retry scope: ALL Gemini endpoints (/chat, /evaluate, /suggestions, /transcribe) via callGemini() — one change, consistent behavior everywhere
- Backoff intervals per REQUIREMENTS.md: 2–4s, 8–16s, 32–64s

**Validation error verbosity (INFRA-04)**
- Field-level Zod error details in 400 responses (e.g. {"error": "text is required"})
- These are internal routes called by the frontend — verbose errors aid development debugging

**Message IDs (INFRA-03)**
- Replace Date.now() with crypto.randomUUID() — already prescribed in REQUIREMENTS.md, no ambiguity

### Claude's Discretion
- Exact retry indicator component/placement within the loading state
- Zod schema organization (inline in route file vs shared validation module)
- Log file format (timestamp, endpoint, error message at minimum)
- Error boundary vs try/catch approach for retry indicator state

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Gemini evaluation failure surfaces an explicit error rather than silently returning default scores (all-5s fallback removed) | evaluateConversation() catch block must throw instead of returning fallback; FeedbackCard needs error state branch |
| INFRA-02 | Gemini API calls retry with exponential backoff (2–4s, 8–16s, 32–64s) before failing with a user-visible error message | callGemini() is the single retry point; jitter pattern documented below; /transcribe uses its own genAI call — must be routed through callGemini() |
| INFRA-03 | All message IDs use crypto.randomUUID() instead of Date.now() to prevent collisions | Two call sites in drill/[id]/page.tsx (lines 134, 158) plus the initial message (line 63 uses literal 'initial' — should also be UUID); no import needed in Node 22 / Next.js 16 |
| INFRA-04 | All API route request bodies are validated with Zod before processing | Zod 4.3.5 is already in node_modules (transitive dep); needs adding to package.json as explicit dep; 5 routes need schemas: /chat, /evaluate, /suggestions, /transcribe (FormData, not JSON), /tts |
</phase_requirements>

---

## Summary

This phase hardens the existing service layer without adding user-facing features. The work falls into four narrow, well-scoped changes: (1) remove the silent all-5s fallback from `evaluateConversation()` and surface errors in `FeedbackCard`, (2) upgrade `callGemini()` from a single 429 retry to a three-attempt exponential-backoff loop with jitter, (3) replace `Date.now()` with `crypto.randomUUID()` at three call sites in `drill/[id]/page.tsx`, and (4) add Zod schemas to all five API routes.

The key pre-existing condition to note: Zod 4.3.5 is already present in `node_modules` as a transitive dependency. It just needs to be added to `package.json` as an explicit dependency — no `yarn add` will modify `node_modules`. The `/transcribe` route currently bypasses `callGemini()` and calls the Gemini SDK directly; this is the only route that needs to be refactored to flow through the shared helper before retry logic will cover it.

**Primary recommendation:** Work in four independent tasks in this order — (1) retry logic in `callGemini()` first since it unblocks INFRA-02 and is the foundation everything else tests against, (2) remove fallback and add FeedbackCard error state, (3) UUID replacement, (4) Zod schemas on all routes.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.3.5 (in node_modules), 4.3.6 (latest) | Request body validation, field-level error messages | Industry standard for TypeScript schema validation in Next.js apps; already present as transitive dep |
| crypto.randomUUID() | Built-in (Node 22 / Web Crypto API) | Collision-resistant UUIDs | Available in all Next.js 16 runtimes without import; RFC 4122 v4, 122 bits of entropy vs 53-bit Date.now() |
| fs (Node built-in) | Built-in | Append-only error log writes | No external logging library needed for single-file append log at this scope |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @google/genai | 1.34.0 (already installed) | Gemini API client — used in callGemini() | Already the project's Gemini client; no change needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zod | yup, valibot | Zod already in node_modules; strong TypeScript inference; no reason to add a different library |
| fs append for logs | winston, pino | Overkill for single-file debug log at this phase; add a proper logger in a later phase if needed |
| crypto.randomUUID() | uuid npm package | uuid is not installed and not needed — Node 22's built-in is equivalent |

**Installation:**

Zod is already present as a transitive dependency. Add it as an explicit dep to make it intentional:

```bash
yarn add zod
```

**Version verification (confirmed 2026-03-20):**
- `zod` in node_modules: 4.3.5 (installed). Latest on npm: 4.3.6. Either is fine for this work.

---

## Architecture Patterns

### File Touch Map

```
src/
├── services/
│   └── gemini.ts              # INFRA-01: remove fallback from evaluateConversation()
│                              # INFRA-02: rewrite callGemini() with 3-attempt backoff + jitter
├── app/
│   ├── api/
│   │   ├── chat/route.ts      # INFRA-04: add Zod schema
│   │   ├── evaluate/route.ts  # INFRA-04: add Zod schema
│   │   ├── suggestions/route.ts  # INFRA-04: add Zod schema
│   │   ├── transcribe/route.ts   # INFRA-02: route through callGemini(); INFRA-04: FormData validation
│   │   └── tts/route.ts       # INFRA-04: add Zod schema (already has manual text check — replace it)
│   └── drill/[id]/page.tsx    # INFRA-03: replace 3x Date.now() with crypto.randomUUID()
├── components/
│   └── FeedbackCard.tsx       # INFRA-01: add error state branch + Retry button
└── [optional] lib/
    └── logger.ts              # structured append to logs/errors.log
logs/
└── errors.log                 # gitignored (needs .gitignore entry)
```

### Pattern 1: Three-Attempt Exponential Backoff with Jitter

**What:** Replace the current single-retry 429 handler in `callGemini()` with a loop that retries up to 3 times on 429 or transient errors, with jitter to avoid thundering herd.

**When to use:** Any network call to an external API that may rate-limit or transiently fail.

**Backoff intervals (from REQUIREMENTS.md):**
- Attempt 1 fails → wait 2–4 seconds (base 2s + random 0–2s jitter)
- Attempt 2 fails → wait 8–16 seconds (base 8s + random 0–8s jitter)
- Attempt 3 fails → throw — caller sees the error

**Retry-eligible errors:** HTTP 429, 503, 502, network timeouts. Do NOT retry on 400/401/403/404 — those are deterministic failures.

```typescript
// Source: standard exponential backoff pattern; verified against Google API best practices
const RETRY_DELAYS_MS = [
  [2000, 4000],   // attempt 1 range
  [8000, 16000],  // attempt 2 range
  [32000, 64000], // attempt 3 range (not used — we throw after 3 attempts)
];

function isRetryableError(error: any): boolean {
  const status = error?.status ?? error?.code;
  return status === 429 || status === 503 || status === 502;
}

function jitteredDelay([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}
```

**Retry attempt state for UI feedback:**

The retry indicator ("Retrying... attempt X of 3") requires the UI to know which attempt is in progress. Two options:

1. `callGemini()` accepts an optional `onRetry?: (attempt: number) => void` callback — called before each retry sleep.
2. `callGemini()` emits nothing; the route layer wraps and tracks state.

Option 1 is simpler and keeps retry state co-located with the retry logic. The callback propagates up through the service function to the API route, and the route streams it back, OR — more practically — the frontend tracks elapsed time against known backoff durations to infer attempt number. Given the UI shows "Retrying... (attempt X of 3)" and the backoff durations are deterministic ranges (2–4s, 8–16s), the simplest approach is to track attempt count inside `callGemini()` and surface it via a callback OR by including it in a thrown error with `attempt` metadata.

**Recommended approach:** Add `onRetryAttempt?: (attempt: number) => void` parameter to `callGemini()`. API routes that care (all of them) pass this through. The route layer uses a local state variable updated by the callback. For the frontend retry indicator, the API response time itself is the implicit signal — but the user decisions say "Retrying... (attempt X of 3)" should be visible, which means the _frontend_ needs to track this, not the backend. The backend just retries transparently; the frontend can show "Evaluating..." and update to "Retrying..." after the first expected timeout window.

**Simplest correct design:** callGemini() retries silently. The frontend starts a timer when the request is sent; if response takes > 3s, it shows "Retrying... (attempt 1 of 3)"; if > 10s, "Retrying... (attempt 2 of 3)". This avoids any streaming or callback complexity.

### Pattern 2: Zod Validation in Next.js API Routes

**What:** Parse request body with a Zod schema before any business logic. Return 400 with field-level error on parse failure.

**Zod v4 import pattern (confirmed working in this project's node_modules):**

```typescript
// Source: verified against zod 4.3.5 in this project's node_modules
import { z } from 'zod';

const ChatRequestSchema = z.object({
  scenarioId: z.string().min(1),
  proficiencyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  conversationHistory: z.array(z.object({
    id: z.string(),
    role: z.enum(['user', 'ai']),
    content: z.string(),
    timestamp: z.number(),
  })),
  userMessage: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = ChatRequestSchema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field = firstIssue.path.join('.') || 'request';
    return NextResponse.json(
      { error: `${field} is required` },
      { status: 400 }
    );
  }

  const { scenarioId, proficiencyLevel, conversationHistory, userMessage } = result.data;
  // ...
}
```

**Zod v4 error shape (verified):**
```json
{
  "code": "invalid_type",
  "expected": "string",
  "path": ["text"],
  "message": "Invalid input: expected string, received undefined"
}
```
`issues[0].path[0]` gives the field name. `issues[0].message` gives the Zod default message.

**FormData validation (transcribe route):** The transcribe route uses `request.formData()`, not JSON. Zod cannot validate FormData directly. Manual validation is appropriate here:

```typescript
const audioFile = formData.get('audio') as Blob | null;
if (!audioFile) {
  return NextResponse.json({ error: 'audio is required' }, { status: 400 });
}
```

The transcribe route already does this check. Bring it in line with the field-level error message convention.

### Pattern 3: FeedbackCard Error State

**What:** FeedbackCard currently receives `evaluation: Evaluation` which is always valid data. To support error state, the component needs to handle the case where evaluation failed.

**Two clean approaches:**

Option A — Optional evaluation prop:
```typescript
interface FeedbackCardProps {
  evaluation?: Evaluation;       // undefined = error state
  evaluationError?: string;      // error message to show
  onRetryEvaluation?: () => void; // retry callback
  metrics: ConversationMetrics;
  onClose: () => void;
  onTryAgain: () => void;
}
```

Option B — Discriminated union:
```typescript
type FeedbackCardProps =
  | { state: 'success'; evaluation: Evaluation; metrics: ConversationMetrics; onClose: () => void; onTryAgain: () => void }
  | { state: 'error'; errorMessage: string; onRetry: () => void; onClose: () => void };
```

Option B is more type-safe and makes the render logic explicit. Recommended.

**Error state layout:** When `state === 'error'`, render inside the same modal shell:
- Hide score breakdown, feedback sections
- Show error message (warm/action-oriented per UX-02 principles)
- Show "Try again" / "Retry evaluation" button

### Pattern 4: Structured Error Logging

**What:** Append-only log to `logs/errors.log` with timestamp, endpoint, and error details.

**Log entry format (minimum per CONTEXT.md):**
```
[2026-03-20T14:32:01.000Z] POST /api/evaluate | GeminiError: 429 Too Many Requests | {"scenarioId":"market-1"}
```

**Implementation:** Use `fs.appendFile` from Node.js built-ins. Since Next.js API routes run server-side (Node runtime, not edge), `fs` is available.

```typescript
// lib/logger.ts
import fs from 'fs';
import path from 'path';

const LOG_PATH = path.join(process.cwd(), 'logs', 'errors.log');

export function logError(endpoint: string, error: unknown, context?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
  const line = `[${timestamp}] ${endpoint} | ${message}${contextStr}\n`;

  // Non-blocking append — fire and forget
  fs.mkdir(path.dirname(LOG_PATH), { recursive: true }, () => {
    fs.appendFile(LOG_PATH, line, () => {/* swallow */});
  });
}
```

**`.gitignore` addition needed:**
```
/logs/
```

### Anti-Patterns to Avoid

- **Silent fallbacks on parse errors:** The existing `evaluateConversation()` catch returns default all-5s scores. This is exactly the pattern INFRA-01 removes. Any future service function that parses JSON from Gemini must throw on parse failure, not return defaults.
- **Retrying non-retryable errors:** Don't retry on 400, 401, 403 — those will never succeed. Only retry on 429, 502, 503, and network errors.
- **Importing `crypto` from node:** `crypto.randomUUID()` is available globally in Node 22 and Next.js 16 edge runtime. No import needed. Using `import crypto from 'crypto'` works but is unnecessary.
- **Blocking log writes:** `fs.writeFileSync` or `await fs.promises.appendFile` in an API route will block the response. Use the async callback form or fire-and-forget.
- **Zod `.parse()` instead of `.safeParse()`:** `.parse()` throws a `ZodError` which must be caught. `.safeParse()` returns `{ success, data, error }` — cleaner in route handlers.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request body validation | Custom required-field checks per route | Zod `.safeParse()` | Already in node_modules; handles type coercion, array validation, enum checks; custom checks miss edge cases |
| Collision-resistant IDs | Timestamp + counter, nanoid | `crypto.randomUUID()` | Built-in, cryptographically random 122-bit UUID; zero dependencies |
| Exponential backoff math | Custom formula | Simple lookup table `[[2000,4000],[8000,16000],[32000,64000]]` | The backoff windows are fixed by the requirements; no need for a formula |

**Key insight:** Every custom solution here has a subtle correctness bug. Custom ID schemes collide under parallel requests; custom validation misses fields; custom backoff formulas drift from specified ranges.

---

## Common Pitfalls

### Pitfall 1: /transcribe Bypasses callGemini()

**What goes wrong:** The retry logic added to `callGemini()` in `gemini.ts` will not apply to `/transcribe` because that route instantiates its own `GoogleGenAI` client and calls `genAI.models.generateContent()` directly. A 429 on transcription will still fail immediately.

**Why it happens:** Transcription uses multimodal content (inlineData with audio), which `callGemini()` does support — the shape is just `contents: [...]`. The route was written independently.

**How to avoid:** Refactor `/transcribe/route.ts` to call `callGemini()` instead of calling the SDK directly. The `callGemini()` signature accepts `contents: any[]` so multimodal parts pass through unchanged.

**Warning signs:** If after INFRA-02 work a 429 test against `/transcribe` still fails immediately, the refactor was missed.

### Pitfall 2: Zod 4 Dual Export API

**What goes wrong:** Zod 4 exports both `import { z } from 'zod'` (classic API) and `import * as z from 'zod/v4'` (new API). Mixing these in the same project causes confusing type errors.

**Why it happens:** Zod 4 maintains backward compatibility via a unified export but has internal v4 restructuring. The `from 'zod'` import works identically to Zod 3 for all patterns used in this phase.

**How to avoid:** Use `import { z } from 'zod'` consistently throughout. Do not use `import { z } from 'zod/v4'` or `import { z } from 'zod/v4/mini'`.

**Verified:** `import { z } from 'zod'` works correctly with `z.object()`, `z.string()`, `z.enum()`, `z.array()`, `.safeParse()` in this project's node_modules (Zod 4.3.5).

### Pitfall 3: FeedbackCard Caller Must Handle Evaluation Errors

**What goes wrong:** `FeedbackCard` is rendered by `drill/[id]/page.tsx`. If the component signature changes to a discriminated union, the call site must be updated too — easy to miss.

**Why it happens:** The evaluation result is fetched inside the page component, then passed to `FeedbackCard`. The fetch can now fail explicitly (INFRA-01 removes the fallback). The page component needs to catch the error and pass `state: 'error'` props.

**How to avoid:** Update the page component's evaluation fetch handler at the same time as FeedbackCard. The `onRetryEvaluation` callback in the error state needs to re-call the `/api/evaluate` endpoint.

### Pitfall 4: logs/ Directory Must Exist Before First Write

**What goes wrong:** `fs.appendFile` fails if the parent directory doesn't exist. If `logs/` is never created, every error log write silently fails.

**Why it happens:** `fs.mkdir({ recursive: true })` + `fs.appendFile` is the correct two-step pattern. Using just `fs.appendFile` with a path that includes a missing parent directory throws `ENOENT`.

**How to avoid:** Use the `fs.mkdir` guard shown in the logger pattern above. Alternatively, create `logs/.gitkeep` in the repo (then `.gitignore` just `logs/errors.log`).

### Pitfall 5: Date.now() Used for timestamp, Not Just id

**What goes wrong:** In `drill/[id]/page.tsx`, `Date.now()` appears at lines 66, 134, 137, 158, 162 — but lines 66, 137, 162 are `timestamp: Date.now()` (correct for a wall-clock timestamp) and lines 134, 158 are `id: \`user-${Date.now()}\`` (the collision-prone IDs). Also line 63 uses `id: 'initial'` (a hardcoded literal, also collision-prone across sessions).

**Why it happens:** The grep for `Date.now()` finds all usages but only the `id:` usages need replacing.

**How to avoid:** Replace only `id: \`user-${Date.now()}\`` and `id: \`ai-${Date.now()}\`` with `crypto.randomUUID()`. The `id: 'initial'` should also become `crypto.randomUUID()` for consistency. Leave `timestamp: Date.now()` unchanged — wall-clock timestamps are correct there.

---

## Code Examples

Verified patterns from codebase inspection and node_modules verification:

### Rewritten callGemini() Skeleton

```typescript
// Source: REQUIREMENTS.md backoff spec + standard retry pattern
const RETRY_WINDOWS_MS: [number, number][] = [
  [2000, 4000],
  [8000, 16000],
  [32000, 64000],
];

function isRetryable(error: any): boolean {
  const status = error?.status ?? error?.statusCode;
  return status === 429 || status === 503 || status === 502;
}

async function callGemini(options: {
  contents: any[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const { contents, systemInstruction, temperature = 0.7, maxOutputTokens = 200 } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await genAI.models.generateContent({
        model: MODEL,
        contents,
        config: { systemInstruction, temperature, maxOutputTokens },
      });
      return response.text || '';
    } catch (error: any) {
      lastError = error;
      if (!isRetryable(error) || attempt === 2) {
        throw error;
      }
      const [min, max] = RETRY_WINDOWS_MS[attempt];
      const delay = min + Math.random() * (max - min);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

### evaluateConversation() — Remove Fallback

```typescript
// BEFORE (silent failure — INFRA-01 target):
} catch {
  return { strength: '...', overallScore: 5, fluencyScore: 5, ... };
}

// AFTER (explicit error propagation):
} catch (error) {
  throw error; // Let the route handler surface this as a 500
}
```

The `/api/evaluate` route's own try/catch returns `{ error: 'Failed to evaluate conversation' }` with status 500. The frontend must handle this case by showing the FeedbackCard error state.

### Zod Schema Examples

```typescript
// Source: verified against zod 4.3.5 in node_modules
import { z } from 'zod';

// /api/chat
const ChatSchema = z.object({
  scenarioId: z.string().min(1),
  proficiencyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  conversationHistory: z.array(z.object({
    id: z.string(),
    role: z.enum(['user', 'ai']),
    content: z.string(),
    timestamp: z.number(),
    translation: z.string().optional(),
  })),
  userMessage: z.string().min(1),
});

// /api/evaluate
const EvaluateSchema = z.object({
  scenarioId: z.string().min(1),
  messages: z.array(z.object({
    id: z.string(),
    role: z.enum(['user', 'ai']),
    content: z.string(),
    timestamp: z.number(),
  })).min(1),
});

// /api/suggestions
const SuggestionsSchema = z.object({
  scenarioId: z.string().min(1),
  proficiencyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  conversationHistory: z.array(z.any()),
  lastAiMessage: z.string().min(1),
});

// /api/tts
const TtsSchema = z.object({
  text: z.string().min(1),
  gender: z.enum(['male', 'female']).optional(),
});

// Error extraction helper (same pattern for all routes)
function zodError(error: z.ZodError): NextResponse {
  const issue = error.issues[0];
  const field = issue.path.length > 0 ? issue.path.join('.') : 'request';
  return NextResponse.json({ error: `${field} is required` }, { status: 400 });
}
```

### crypto.randomUUID() in drill page

```typescript
// Before:
id: `user-${Date.now()}`
id: `ai-${Date.now()}`
id: 'initial'

// After (no import needed — global in Node 22 / Next.js 16):
id: crypto.randomUUID()
id: crypto.randomUUID()
id: crypto.randomUUID()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod v3 `z.ZodError` throw from `.parse()` | Zod v4 `.safeParse()` returns `{ success, data, error }` | Zod 4.0 (2025) | Cleaner route handlers — no try/catch needed for validation |
| `import { v4 as uuidv4 } from 'uuid'` | `crypto.randomUUID()` built-in | Node 14.17 / Web Crypto standardization | Zero dependency UUID generation |

**Deprecated/outdated in this project:**
- `callGemini()` single-retry 429 handler: replaced by 3-attempt backoff loop
- `evaluateConversation()` all-5s fallback: removed entirely (INFRA-01)
- `Date.now()` for message IDs: collision-prone at millisecond resolution under parallel requests

---

## Open Questions

1. **Retry indicator UX implementation approach**
   - What we know: User should see "Retrying... (attempt X of 3)" during backoff
   - What's unclear: Whether to implement via frontend timer inference vs. backend streaming/callback; the backoff windows have jitter so frontend timer cannot be exact
   - Recommendation: Use frontend timer inference as the simplest approach — show "Retrying..." after 3s elapsed, update attempt count estimate based on cumulative elapsed time; or keep the loading indicator generic ("Evaluating...") and only show attempt number if a specific API design for signaling retry state is decided during planning

2. **Zod schema location — inline vs shared module**
   - What we know: CONTEXT.md leaves this to Claude's discretion
   - What's unclear: Whether future phases will reuse these schemas (Phase 2 adds auth routes; Phase 4 adds adaptive difficulty routes)
   - Recommendation: Inline in each route file for this phase. Create `src/lib/schemas/` only if schemas need sharing in a future phase. Avoids premature abstraction.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected in project |
| Config file | None — Wave 0 must add test infrastructure |
| Quick run command | `yarn test` (after Wave 0 setup) |
| Full suite command | `yarn test` |

**Note:** No test files exist in `src/`. Only `node_modules/` tests are present (from Zod and tsconfig-paths). This project has zero test infrastructure. Wave 0 must establish it.

Given the Next.js 16 + React 19 + TypeScript stack, **Vitest** is the recommended test framework for this phase — it runs without DOM (unit tests for service logic), supports TypeScript natively, and integrates well with Next.js projects.

Recommended setup:
```bash
yarn add -D vitest @vitest/coverage-v8
```

Config (`vitest.config.ts`):
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | evaluateConversation() throws on parse failure instead of returning fallback | unit | `yarn test src/services/gemini.test.ts` | ❌ Wave 0 |
| INFRA-01 | FeedbackCard renders error state when evaluation prop is absent | unit (component) | manual smoke (no DOM test env) | ❌ Wave 0 |
| INFRA-02 | callGemini() retries exactly 3 times on 429, uses correct delay ranges | unit | `yarn test src/services/gemini.test.ts` | ❌ Wave 0 |
| INFRA-02 | callGemini() does not retry on 400 | unit | `yarn test src/services/gemini.test.ts` | ❌ Wave 0 |
| INFRA-03 | Message IDs are valid UUIDs (RFC 4122 v4 format) | unit | `yarn test src/app/drill` | ❌ Wave 0 — complex to unit test page component; validate via e2e or manual |
| INFRA-04 | /api/chat returns 400 with field-level error on missing scenarioId | integration | manual or `curl` smoke test | ❌ Wave 0 |
| INFRA-04 | /api/evaluate returns 400 on empty messages array | integration | manual or `curl` smoke test | ❌ Wave 0 |
| INFRA-04 | /api/tts returns 400 on missing text | integration | manual or `curl` smoke test | ❌ Wave 0 |

**Practical test scope for this phase:** The highest-value automated tests are unit tests for `callGemini()` retry logic (mock the SDK, assert retry count and delay ranges) and `evaluateConversation()` error propagation (mock `callGemini` to throw, assert the error propagates rather than returning a fallback). API route validation is best verified with `curl` smoke tests given no integration test harness exists.

### Sampling Rate

- **Per task commit:** `yarn test src/services/gemini.test.ts` (once Wave 0 creates it)
- **Per wave merge:** `yarn test`
- **Phase gate:** All tests green + manual smoke tests on all 5 API routes before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — test framework config
- [ ] `src/services/gemini.test.ts` — covers INFRA-01, INFRA-02
- [ ] Framework install: `yarn add -D vitest @vitest/coverage-v8`

---

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection (`src/services/gemini.ts`, `src/app/api/*/route.ts`, `src/app/drill/[id]/page.tsx`, `src/components/FeedbackCard.tsx`, `src/types/index.ts`) — current state of all affected files
- `node_modules/zod/package.json` — confirmed Zod 4.3.5 already installed
- Node.js 22 runtime — `crypto.randomUUID()` confirmed available globally
- `.planning/REQUIREMENTS.md` — exact backoff intervals and acceptance criteria
- `.planning/phases/01-gemini-stabilization/01-CONTEXT.md` — locked implementation decisions

### Secondary (MEDIUM confidence)
- npm registry — `npm view zod version` returned 4.3.6 as latest (Zod 4.3.5 in project is one patch behind, acceptable)
- Zod v4 API verified by running `node -e` tests against installed package

### Tertiary (LOW confidence)
- None — all claims verified against installed package or project source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Zod version confirmed by direct inspection of node_modules; crypto.randomUUID() confirmed in Node 22
- Architecture: HIGH — all patterns verified against actual code in the repo; no assumptions about file locations
- Pitfalls: HIGH — Pitfalls 1 and 5 discovered by direct code inspection (transcribe bypass, Date.now() timestamp vs id distinction)

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable dependencies; Zod 4.x API is stable)
