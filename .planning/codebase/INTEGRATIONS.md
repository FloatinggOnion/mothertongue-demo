# External Integrations

**Analysis Date:** 2026-03-20

## APIs & External Services

**AI/LLM:**
- Google Generative AI (Gemini) - Powers conversational AI, text evaluation, and transcription
  - SDK/Client: `@google/genai` v1.34.0
  - Auth: `GEMINI_API_KEY` environment variable
  - Usage: `src/services/gemini.ts`
  - Models used:
    - `gemini-2.5-flash` (default for chat/conversation)
    - `gemini-2.0-flash` (for audio transcription)

**Text-to-Speech:**
- Google Cloud Text-to-Speech API - Generates speech audio for Yoruba language learning
  - SDK/Client: `@google-cloud/text-to-speech` v6.4.0
  - Auth: Service account credentials (`GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY`)
  - Usage: `src/app/api/tts/route.ts`
  - Voices: Nigerian English Wavenet voices
    - `en-NG-Wavenet-A` - Female voice (default)
    - `en-NG-Wavenet-B` - Male voice
  - Audio format: MP3 at 1.0x speaking rate

## Data Storage

**Databases:**
- None detected - Application is stateless/client-side session storage only

**File Storage:**
- Local filesystem only - Audio generation happens server-side, returned as binary response

**Caching:**
- None detected - No Redis or in-memory caching configured

## Authentication & Identity

**Auth Provider:**
- None - No user authentication system
- Implementation: Public application without user accounts
- Sessions: Conversation state managed client-side (no server-side session storage)

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Datadog, or similar service

**Logs:**
- Console logging only
  - `console.error()` for API errors and failures
  - `console.log()` for rate limit handling in `src/services/gemini.ts`
  - No structured logging or log aggregation

## CI/CD & Deployment

**Hosting:**
- Vercel (implicit from Next.js default and `.vercel` directory presence)

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or similar configured

## Environment Configuration

**Required env vars:**
- `GEMINI_API_KEY` - Required for all AI/LLM operations
- `GOOGLE_CLIENT_EMAIL` - Required for Text-to-Speech
- `GOOGLE_PRIVATE_KEY` - Required for Text-to-Speech

**Optional env vars:**
- `GEMINI_MODEL` - Override default model (defaults: `gemini-2.5-flash` for chat, `gemini-2.0-flash` for transcription)

**Secrets location:**
- `.env.local` file (development)
- Environment variables in Vercel dashboard (production)

## API Endpoints

**Internal (Next.js API Routes):**
- `POST /api/chat` - Generate AI partner response
  - Input: `{ scenarioId, proficiencyLevel, conversationHistory, userMessage }`
  - Output: `{ reply, translation }`
  - Uses: Gemini API via `getPartnerResponse()`

- `POST /api/transcribe` - Transcribe user audio
  - Input: FormData with `audio` blob
  - Output: `{ transcription }`
  - Uses: Gemini multimodal API for audio processing

- `POST /api/tts` - Generate speech audio
  - Input: `{ text, gender }`
  - Output: MP3 audio buffer
  - Uses: Google Cloud Text-to-Speech API

- `POST /api/evaluate` - Evaluate conversation performance
  - Input: `{ scenarioId, messages }`
  - Output: `{ strength, strengthExample, improvement, correctedSentence, overallScore, fluencyScore, grammarScore, confidenceScore }`
  - Uses: Gemini API via `evaluateConversation()`

- `POST /api/suggestions` - Get reply suggestions
  - Input: `{ scenarioId, proficiencyLevel, conversationHistory, lastAiMessage }`
  - Output: `{ suggestions: [{ text, translation }] }`
  - Uses: Gemini API via `getReplySuggestions()`

**Webhooks & Callbacks:**
- None detected - Application has no webhook endpoints or outbound webhook calls

## Rate Limiting & Error Handling

**Rate Limiting:**
- Gemini API 429 (Rate Limited) handling implemented in `src/services/gemini.ts`
  - Strategy: Exponential backoff (8 second wait)
  - Retry: Single retry after rate limit
  - Fallback: Graceful degradation with static fallback responses in `getReplySuggestions()`

**Error Handling:**
- Credential validation: Detects missing/invalid Google Cloud credentials
- API failures: Graceful fallbacks with static responses for suggestions
- Transcription failures: Returns error response to client
- TTS failures: Returns 500 error with descriptive message

## Dependencies Risk Assessment

**Critical Dependencies:**
- Google Generative AI API (Gemini) - Blocking dependency for core functionality
  - If unavailable: Chat, suggestions, evaluation, transcription fail
  - Rate limit handling present but not fully robust

- Google Cloud TTS API - Blocking dependency for speech generation
  - If unavailable: Speech generation fails
  - No fallback mechanism

**Fallback Strategy:**
- Gemini API: Static fallback suggestions for `getReplySuggestions()`
- Google Cloud TTS: No fallback
- Transcription: No fallback (returns error)

---

*Integration audit: 2026-03-20*
