# Coding Conventions

**Analysis Date:** 2026-03-20

## Naming Patterns

**Files:**
- Components (React): PascalCase with `.tsx` extension - `MicButton.tsx`, `FeedbackCard.tsx`, `ScenarioCard.tsx`
- Hooks: camelCase with `use` prefix and `.ts` extension - `useSpeech.ts`, `useSpeechRecognition()`
- API routes: lowercase with implicit naming based on directory structure - `/src/app/api/chat/route.ts`, `/src/app/api/tts/route.ts`
- Configuration files: camelCase `.ts` or `.tsx` - `scenarios.ts`
- Type definitions: PascalCase in `index.ts` within `types/` directory

**Functions:**
- React components: PascalCase exported - `export function MicButton()`, `export function FeedbackCard()`
- Helper functions: camelCase - `buildPartnerSystemPrompt()`, `callGemini()`, `formatTime()`
- Server actions: camelCase with explicit `'use server'` directive - `getPartnerResponse()`, `evaluateConversation()`
- Custom hooks: camelCase with `use` prefix - `useSpeechRecognition()`, `useSpeechSynthesis()`
- API route handlers: `POST`, `GET` uppercase for HTTP methods

**Variables:**
- State variables: camelCase - `isListening`, `isSpeaking`, `isLoading`, `transcript`, `interimTranscript`
- Constants: UPPER_SNAKE_CASE - `VOICE_MAPPING`, `MODEL`
- Types/Interfaces: PascalCase - `MicButtonProps`, `UseSpeechRecognitionReturn`, `GeminiResponse`
- Private/internal: camelCase prefixed with underscore if truly private (rare, prefer encapsulation via scope)

**Types:**
- Interfaces for props: PascalCase with `Props` suffix - `MicButtonProps`, `FeedbackCardProps`, `UseSpeechRecognitionReturn`
- Type aliases for domain models: PascalCase - `ProficiencyLevel`, `Scenario`, `Message`, `Evaluation`
- Enum-like unions: lowercase literal strings - `'beginner' | 'intermediate' | 'advanced'`, `'user' | 'ai'`, `'male' | 'female'`

## Code Style

**Formatting:**
- Tool: None explicitly configured (ESLint handles linting, no Prettier detected)
- Indentation: 2 spaces (inferred from code samples)
- Line length: No hard limit detected, but examples stay under 120 characters
- String quotes: Single quotes preferred in code files, double quotes in JSX attributes
- Semicolons: Required at statement ends

**Linting:**
- Tool: ESLint 9 with Next.js config
- Config: `eslint.config.mjs` using ESLint flat config format
- Presets applied: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Ignored directories: `.next`, `out`, `build`, `next-env.d.ts`

**TypeScript:**
- Strict mode enabled: `"strict": true` in `tsconfig.json`
- JSX handling: `"jsx": "react-jsx"` (React 19+)
- Target: ES2017
- Module resolution: bundler (Next.js)
- Path aliases: `@/*` maps to `./src/*` for absolute imports

## Import Organization

**Order:**
1. Next.js/React framework imports - `import { NextRequest, NextResponse } from 'next/server'`
2. Third-party library imports - `import { GoogleGenAI } from '@google/genai'`
3. Local type imports - `import { Scenario, Message, ... } from '@/types'`
4. Local service/utility imports - `import { getPartnerResponse } from '@/services/gemini'`
5. Local config imports - `import { scenarios, getScenarioById } from '@/config/scenarios'`

**Path Aliases:**
- `@/*` - resolves to `./src/*` for clean absolute imports
- Used consistently across components, services, hooks, and API routes

**Naming conventions in imports:**
- Named imports preferred: `import { MicButton, FeedbackCard } from '@/components'`
- Barrel exports used: `src/components/index.ts` exports all components for convenient importing
- Aliased imports when needed: `import { TextToSpeechClient } from '@google-cloud/text-to-speech'`

## Error Handling

**Patterns:**
- Try/catch blocks with typed error objects: `catch (error: any)` used in async functions
- Console logging for diagnostics: `console.error('Chat API error:', error)`, `console.log('Rate limited, waiting...')`
- Graceful fallbacks in API calls: JSON parse errors caught and fallback data returned - see `getReplySuggestions()` returning hardcoded suggestions on failure
- Silent failures with logging: Translation calls wrap try/catch without throwing, use original text if translation fails
- Typed error handling: `error?.status` and `error?.message` checks for specific error conditions

**Example patterns:**
```typescript
// Rate limiting retry with exponential backoff
if (error?.status === 429) {
  console.log('Rate limited, waiting 8 seconds...');
  await new Promise((resolve) => setTimeout(resolve, 8000));
  // retry logic
}

// Fallback on parsing failure
try {
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
} catch {
  return [{ text: 'Ẹ ṣe o', translation: 'Thank you' }];
}

// Silent API error handling
catch (err) {
  console.error('Transcription error:', err);
  setError('Failed to process audio');
}
```

## Logging

**Framework:** Native `console` (no logging library)

**Patterns:**
- `console.error()` for errors and failures - `console.error('Chat API error:', error)`
- `console.warn()` for warnings - `console.warn('Native start failed, using fallback:', e)`
- `console.log()` for informational messages - `console.log('Rate limited, waiting 8 seconds...')`
- Log context included with messages: function/API name, user-friendly status info
- No debug logging in production code

**When to log:**
- API errors and failures with context
- State transitions for debugging (fallback mechanisms, rate limiting)
- User-facing error messages
- Critical flow decisions (switching to fallback, retrying)

## Comments

**When to Comment:**
- Complex logic explanations (e.g., "We need to access startMediaRecording from within event handlers...")
- Section markers for major code blocks - `// --- Speech Recognition Hook ---`
- Critical rules and constraints in system prompts
- Workaround explanations (e.g., refs to break dependency cycles)
- Do NOT comment obvious code

**JSDoc/TSDoc:**
- Limited use; interfaces are self-documenting
- Function parameters documented via TypeScript types
- Complex function purposes briefly explained in code comments above function
- No formal JSDoc blocks detected in codebase

**Example:**
```typescript
// We need to access startMediaRecording from within the recognition event handlers
// which are defined in a useEffect. We use a ref to break the dependency cycle.
const startMediaRecordingRef = useRef<() => void>(() => {});
```

## Function Design

**Size:**
- Small, focused functions preferred (most 20-40 lines)
- API route handlers keep logic minimal, delegate to services
- Helper functions encapsulate complex business logic (`buildPartnerSystemPrompt`, `buildEvaluatorSystemPrompt`)

**Parameters:**
- Explicit parameter objects for functions with 3+ parameters:
  ```typescript
  async function callGemini(options: {
    contents: any[];
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
  }): Promise<string>
  ```
- Destructuring in component props:
  ```typescript
  export function MicButton({
    isListening,
    isSpeaking,
    isLoading,
    onPress,
    onRelease,
  }: MicButtonProps)
  ```

**Return Values:**
- Single return type per function (no union returns for different cases)
- Functions return data or throw on error (no null/undefined for errors)
- Async functions return Promise of concrete type: `Promise<string>`, `Promise<GeminiResponse>`, `Promise<Evaluation>`
- Success/failure differentiated via try/catch and fallback values

**Example:**
```typescript
export async function getPartnerResponse(
  scenario: Scenario,
  proficiencyLevel: ProficiencyLevel,
  conversationHistory: Message[],
  userMessage: string
): Promise<GeminiResponse> {
  // ...implementation
  return {
    reply,
    translation: translation || reply,
  };
}
```

## Module Design

**Exports:**
- Named exports preferred: `export function MicButton()`, `export async function getPartnerResponse()`
- Server-side directives at module top: `'use server'`, `'use client'`
- Single responsibility per file

**Barrel Files:**
- Used in `src/components/index.ts` to simplify imports:
  ```typescript
  export { MessageBubble, ConversationView } from './ConversationView';
  export { FeedbackCard } from './FeedbackCard';
  export { ReplySuggestions } from './ReplySuggestions';
  export { MicButton } from './MicButton';
  export { ScenarioCard } from './ScenarioCard';
  ```
- Allows `import { MicButton, FeedbackCard } from '@/components'` instead of individual paths

---

*Convention analysis: 2026-03-20*
