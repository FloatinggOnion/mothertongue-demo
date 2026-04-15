# Codebase Concerns

**Analysis Date:** 2026-03-20

## Tech Debt

**Weak Type Safety - Pervasive Use of `any` Type:**
- Issue: Multiple instances of `error: any` and untyped error handling throughout codebase. 264+ occurrences of `any`, `unknown`, `as`, and non-null assertion (`!`) operators suggest insufficient type strictness.
- Files: `src/services/gemini.ts` (lines 38, 55), `src/app/api/tts/route.ts` (line 62), `src/hooks/useSpeech.ts` (multiple error handlers), `src/app/drill/[id]/page.tsx`
- Impact: Runtime errors may occur without type-time detection. Hard to refactor safely. Reduces IDE autocompletion reliability. Non-null assertions (`!`) create silent failure points.
- Fix approach: Enable `strict: true` in `tsconfig.json`, use specific error types instead of `any`, create discriminated union types for API responses, add proper error boundary types.

**Inconsistent Error Handling Across APIs:**
- Issue: API routes catch errors but return generic 500 responses. Error details logged to console but not structured. No error codes or categorization (validation vs auth vs service errors).
- Files: `src/app/api/chat/route.ts` (lines 41-47), `src/app/api/evaluate/route.ts` (lines 28-34), `src/app/api/tts/route.ts` (lines 62-77), `src/app/api/transcribe/route.ts` (lines 47-52), `src/app/api/suggestions/route.ts` (lines 37-43)
- Impact: Client cannot distinguish error types. Hard to retry strategically. Logs are verbose but unhelpful for debugging in production.
- Fix approach: Create error response wrapper with error codes (AUTH_FAILED, RATE_LIMITED, INVALID_INPUT, SERVICE_ERROR). Implement structured logging with context. Add client-side retry logic for specific error types.

**Silent Fallbacks Hide Failures:**
- Issue: Multiple fallback patterns return placeholder data instead of failing loudly. `getReplySuggestions()` returns static suggestions on JSON parse error. `evaluateConversation()` returns dummy scores (all 5s). `translateText()` returns original text on failure.
- Files: `src/services/gemini.ts` (lines 236-244, 279-289, 312-314), `src/hooks/useSpeech.ts` (lines 87-96)
- Impact: Users may believe the app is working when critical services fail. AI responses may be hallucinated fallbacks. Feedback scores become meaningless. Hard to notice and fix production issues.
- Fix approach: Distinguish between degraded-but-acceptable (e.g., returning original text for translation) vs critical failures (e.g., evaluation). Emit error events to monitoring. Return explicit "service unavailable" to user for critical failures.

**Hardcoded API Model Names and Versions:**
- Issue: Model names hardcoded in multiple places. `src/services/gemini.ts` line 16 uses `gemini-2.5-flash` with fallback. `src/app/api/transcribe/route.ts` line 5 uses `gemini-2.0-flash`. No version management or gradual rollout capability.
- Files: `src/services/gemini.ts` (line 16), `src/app/api/transcribe/route.ts` (line 5)
- Impact: Changing models requires code changes in multiple places. No A/B testing capability. Version mismatches if not carefully synchronized. Hard to roll back if model is deprecated.
- Fix approach: Centralize model configuration in `src/config/models.ts`. Use environment variables for model names. Implement feature flags for model selection.

## Known Bugs

**Speech Recognition Fallback Logic is Fragile:**
- Symptoms: Native speech recognition may silently switch to fallback recording without user awareness. `forceFallback` state flag prevents recovery to native if browser support improves.
- Files: `src/hooks/useSpeech.ts` (lines 24, 131-135, 171-175)
- Trigger: Browser with network error or offline mode. User may not realize they're using lossy fallback. Network restored but fallback remains active.
- Workaround: User must reload page to retry native speech recognition. Manual switch to text input is available.
- Fix approach: Add explicit UI indicator when fallback is active. Allow manual retry of native recognition. Store fallback preference in session storage (not localStorage) to reset on page reload.

**Modal Inference Breaking (Unfinished Feature):**
- Symptoms: `.gitignore` file modified (line 44: `*.json` added). Git status shows modified package.json and yarn.lock. Commit message "add modal inference" suggests incomplete feature.
- Files: `src/app/api/tts/route.ts` (modified, lines 1-79)
- Trigger: Recent commit 361c154. Feature incomplete or breaking in production.
- Workaround: May need to revert commit 361c154 or complete implementation.
- Fix approach: Review commit 361c154. Complete modal inference feature or revert if not critical. Update `.gitignore` to stop excluding all JSON (breaks config).

**Transcription API Uses Mismatched Model Configuration:**
- Symptoms: `src/app/api/transcribe/route.ts` hardcodes `gemini-2.0-flash` while main service uses configurable `gemini-2.5-flash`. Inconsistency may cause version-specific issues.
- Files: `src/app/api/transcribe/route.ts` (line 5)
- Trigger: Different model versions have different rate limits and performance profiles.
- Workaround: None - feature works but may have inconsistent behavior.
- Fix approach: Unify to use same model configuration system as `src/services/gemini.ts`.

**Rate Limit Retry Uses Hardcoded Sleep:**
- Symptoms: 429 error handling in `callGemini()` uses hardcoded 8-second delay. No exponential backoff, no max retries, only retries once.
- Files: `src/services/gemini.ts` (lines 40-59)
- Trigger: High load or API rate limits triggered. Multiple concurrent calls exhaust retry quota quickly.
- Workaround: Users see failure after 8+ seconds. Manual retry required.
- Fix approach: Implement exponential backoff with jitter. Configurable max retries. Track retry attempts per request.

## Security Considerations

**API Key Exposure Risk in TTS Route:**
- Risk: Google Cloud credentials passed directly in client request path. Private key in environment contains literal newline characters that require string replacement at runtime (line 14). If logging or error messages leak, credentials exposed.
- Files: `src/app/api/tts/route.ts` (lines 11-16)
- Current mitigation: Private key protected by environment variable. Credentials not logged explicitly (but caught in catch-all error logs).
- Recommendations:
  - Implement structured logging that strips sensitive values
  - Use service account key files instead of embedding in env vars
  - Add request signature validation to ensure TTS calls come from authenticated users
  - Rate limit `/api/tts` endpoint to prevent abuse

**No Request Validation on API Routes:**
- Risk: API endpoints accept any JSON structure. Missing fields silently become undefined. Requests not validated against schema.
- Files: `src/app/api/chat/route.ts` (lines 11-22), `src/app/api/evaluate/route.ts` (lines 8-15), `src/app/api/suggestions/route.ts` (lines 8-19), `src/app/api/transcribe/route.ts` (lines 9-14)
- Current mitigation: Basic null checks (e.g., `if (!text)` in TTS). No schema validation library.
- Recommendations:
  - Use Zod or TypeBox for request validation
  - Validate all inputs before calling external APIs
  - Return 400 (Bad Request) for invalid inputs, not 500 (Server Error)
  - Implement rate limiting by IP or user

**Unencrypted Audio Storage in Memory:**
- Risk: Audio blobs held in `chunksRef` (useSpeech.ts line 28) and transmitted over HTTP (not HTTPS enforced). No indication of HTTPS requirement.
- Files: `src/hooks/useSpeech.ts` (lines 27-28, 52-65)
- Current mitigation: None detected.
- Recommendations:
  - Enforce HTTPS in Next.js config
  - Implement CORS headers to prevent cross-origin audio theft
  - Clear audio data after successful transcription
  - Consider client-side encryption of audio before transmission

**Client-Side Proficiency Level Hardcoded:**
- Risk: User proficiency level hardcoded to 'beginner' in drill page (line 30). No validation that selected level matches user account. User can't change difficulty without code modification.
- Files: `src/app/drill/[id]/page.tsx` (line 30)
- Current mitigation: None - this is a limitation, not a security risk directly, but enables cheating.
- Recommendations:
  - Load proficiency level from user context or query parameter
  - Validate level against user account on server
  - Store level in session/database, not client state

## Performance Bottlenecks

**Synchronous Translation Calls Block UI:**
- Problem: `getPartnerResponse()` makes two sequential API calls: first for reply, then for translation (lines 162-189). Second call waits for first to complete. Both use Gemini API, both count against rate limits.
- Files: `src/services/gemini.ts` (lines 162-189)
- Cause: Translation fetch inside `try` block without `Promise.all()`. No parallel execution.
- Improvement path:
  - Fetch translation in parallel with reply using Promise.all()
  - Implement optimistic translation (show reply immediately, fill translation as it arrives)
  - Consider server-side translation caching
  - Add request deduplication to prevent duplicate translation calls

**Silent 10-Second Wait for Suggestions Delays Interaction:**
- Problem: After user stops speaking, app silently waits 10 seconds before fetching suggestions (line 89). User sees no feedback, may think app is frozen.
- Files: `src/app/drill/[id]/page.tsx` (lines 85-97)
- Cause: Arbitrary timeout with no user-visible progress. UX is confusing.
- Improvement path:
  - Show "Waiting for suggestions..." indicator after 5 seconds
  - Allow user to manually trigger suggestions
  - Use `setTimeout` more conservatively (3-5 seconds)
  - Cancel timeout if user starts speaking again

**Conversation Messages Array Unbounded:**
- Problem: `messages` array grows indefinitely with no pagination or virtualization. Long conversations (50+ exchanges) cause scroll performance degradation.
- Files: `src/app/drill/[id]/page.tsx` (lines 28, 139, 164)
- Cause: All messages rendered in DOM. No windowing or lazy loading.
- Improvement path:
  - Implement virtual scrolling (react-window) for long conversations
  - Paginate conversation history server-side
  - Archive old messages after session ends
  - Profile scroll performance with DevTools

**No Request Debouncing or Caching:**
- Problem: Each suggestion request is independent. Suggestions fetched for same `lastAiMessage` multiple times if user pauses multiple times.
- Files: `src/app/drill/[id]/page.tsx` (lines 99-125)
- Cause: No deduplication or cache layer.
- Improvement path:
  - Cache suggestions keyed by scenario+level+lastAiMessage hash
  - Implement request debouncing (wait 500ms after silence before fetching)
  - Use SWR or React Query for automatic caching

## Fragile Areas

**Gemini Service Layer Has Single Point of Failure:**
- Files: `src/services/gemini.ts`
- Why fragile:
  - All AI functionality centralizes in one file (315 lines)
  - Multiple overlapping responsibilities: conversation, translation, suggestions, evaluation
  - Retry logic is minimal (only for rate limit, only once)
  - No circuit breaker pattern if API becomes unavailable
  - Hard to unit test due to external API dependency
- Safe modification:
  - Don't change temperature/maxOutputTokens without A/B testing impact
  - New features should split into separate helper functions
  - Add integration tests before modifying
  - Use dependency injection for GenAI client to enable mocking
- Test coverage: No tests detected. High risk for regressions.

**Speech Recognition Hook Manages Too Many Concerns:**
- Files: `src/hooks/useSpeech.ts` (297 lines)
- Why fragile:
  - Handles both native speech recognition AND fallback MediaRecorder recording
  - Complex ref management with `startMediaRecordingRef` to break dependency cycles (lines 30-32)
  - Nested callbacks within useEffect create hard-to-follow data flow
  - `forceFallback` flag prevents recovery and may cause permanent state issues
  - Error handling differs between native and fallback paths
- Safe modification:
  - Extract MediaRecorder logic to separate hook (`useMediaRecorder()`)
  - Extract speech recognition to separate hook (`useNativeSpeechRecognition()`)
  - Add JSDoc comments explaining ref hack
  - Write unit tests for each error path before refactoring
- Test coverage: No tests detected. High risk for audio recording regressions.

**Drill Page Component Handles Too Many State Concerns:**
- Files: `src/app/drill/[id]/page.tsx` (428 lines)
- Why fragile:
  - Manages messages, suggestions, evaluation, proficiency level, speaking time, drill state all in one component
  - Multiple API calls (`/api/chat`, `/api/suggestions`, `/api/evaluate`, `/api/tts`, `/api/transcribe`)
  - Complex useEffect dependency chains (lines 85-97 has 5 dependencies)
  - Loading states not fully synchronized (could show loading while fetching suggestions)
  - No error boundaries - API failures show console errors but no user feedback
- Safe modification:
  - Extract suggestion logic to custom hook (`useSuggestions()`)
  - Extract evaluation logic to custom hook (`useEvaluation()`)
  - Add explicit error state and error boundary component
  - Test all API failure scenarios before refactoring
- Test coverage: No tests detected. High risk for integration bugs.

**Message ID Generation Uses Timestamp (Collision Risk):**
- Files: `src/app/drill/[id]/page.tsx` (line 134), `src/app/page.tsx` (not present but pattern used)
- Why fragile:
  - Message IDs generated as `user-${Date.now()}` or `ai-${Date.now()}`
  - If two messages sent within same millisecond, IDs collide
  - React keys become non-unique, causing render bugs
  - Conversation may lose messages or display wrong content
- Safe modification:
  - Use UUID library (install `uuid` package)
  - Replace `Date.now()` with `crypto.randomUUID()` or `nanoid()`
  - Add test to verify ID uniqueness under rapid fire
- Test coverage: No tests. Risk of subtle render bugs.

## Scaling Limits

**Gemini API Rate Limits Not Managed:**
- Current capacity: Unknown - depends on Gemini plan tier
- Limit: Sequential translation calls (2 per user reply) + suggestions calls (1 every 10s) will quickly hit rate limits with 5+ concurrent users
- Scaling path:
  - Implement request queuing with priority (chat > suggestions > translation)
  - Add per-user rate limiting (e.g., 5 API calls per 10 seconds)
  - Cache translation results to avoid duplicate calls
  - Move suggestions to background task (show cached results while fetching new ones)
  - Implement response caching (Redis/Memcache)

**No Database - Everything In-Memory:**
- Current capacity: Single session can have 100+ messages without issue. No session persistence.
- Limit: Server restart loses all conversation history. Multiple deployments cause session loss. Can't load previous drills.
- Scaling path:
  - Add database (Supabase, Firebase, or PostgreSQL) to store sessions
  - Persist drill results for user history/progression tracking
  - Implement session recovery on reconnect
  - Add cleanup job for abandoned sessions

**Audio File Size Not Managed:**
- Current capacity: Typical speech is <1MB in webm format. Gemini API has undocumented size limits.
- Limit: Very long audio files (>5 minutes) may fail or exceed model input limits.
- Scaling path:
  - Add audio length validation (reject >5 min)
  - Implement audio compression/downsampling
  - Split long audio into chunks for transcription

## Dependencies at Risk

**Outdated Type Dependencies:**
- Risk: `@types/node` and `@types/react` pinned to major versions (^20, ^19) but likely behind latest
- Impact: Type errors in new Node/React releases. Missing type definitions for new APIs.
- Migration plan:
  - Run `npm outdated` to identify gaps
  - Update major versions incrementally with test coverage
  - Use `@types/node@latest` and test against latest Node LTS

**@google/genai SDK Not Officially Stable:**
- Risk: Google's official GenAI SDK is new (v1.34.0). May have breaking changes in minor versions.
- Impact: API changes could break transcription or chat without warning. Documentation may lag.
- Migration plan:
  - Pin exact version in package.json (not ^)
  - Monitor Google's GitHub for breaking changes
  - Have fallback to REST API if SDK breaks
  - Test SDK updates in staging before production

**No Dependency Security Scanning:**
- Risk: yarn.lock modified but no evidence of security audits. No CI/CD pipeline scanning for vulnerabilities.
- Impact: Vulnerable dependencies could be silently introduced.
- Migration plan:
  - Add `npm audit` or `yarn audit` to CI/CD
  - Use Dependabot or Snyk for automated security updates
  - Set up renovate for regular dependency updates

## Missing Critical Features

**No Persistence - Sessions Lost on Reload:**
- Problem: All conversation state stored in React state only. Refreshing page loses drill session. Users can't resume paused conversations.
- Blocks: Can't offer drill history, progress tracking, or session recovery. Can't analyze user patterns.
- Priority: Medium - limits user retention but not core functionality

**No User Authentication:**
- Problem: No login system. All users are anonymous. Can't track individual progress or provide personalized settings.
- Blocks: Can't implement proficiency level per user. Can't save drill history. Can't offer spaced repetition.
- Priority: High - required for real product use

**No Progress Tracking or Statistics:**
- Problem: Evaluation returned after each drill but not stored. No way to see improvement over time.
- Blocks: Can't motivate users with progress metrics. Can't recommend scenarios based on performance.
- Priority: Medium - nice-to-have for engagement

**No Offline Support:**
- Problem: App requires Gemini API. No offline mode or cached responses.
- Blocks: Can't practice in areas with poor connectivity.
- Priority: Low - edge case but valuable for learning

**Missing Proficiency Level Selection:**
- Problem: Hardcoded to 'beginner'. Users can't change difficulty.
- Blocks: Can't offer progressive difficulty. Advanced learners are bored with beginner content.
- Priority: High - core feature gap

## Test Coverage Gaps

**No Unit Tests Anywhere:**
- What's not tested:
  - Gemini service functions (getPartnerResponse, evaluateConversation, getReplySuggestions)
  - Error handling in all API routes
  - Message ID uniqueness
  - Rate limit retry logic
  - Suggestion fallback logic
- Files:
  - `src/services/gemini.ts` (0% coverage)
  - All API routes in `src/app/api/*/route.ts` (0% coverage)
  - `src/hooks/useSpeech.ts` (0% coverage)
- Risk: Regressions undetected. Refactoring dangerous. Unknown behavior in edge cases.
- Action: Add Jest + @testing-library tests. Start with happy path, then error cases.

**No Integration Tests:**
- What's not tested:
  - Full conversation flow (user speech → transcription → AI response → suggestions)
  - Error recovery (API failures, network issues)
  - Evaluation generation with real Gemini API
- Risk: Features work in isolation but break when integrated. Unknown user experience issues.
- Action: Add integration tests with mocked Gemini API. Test all API routes end-to-end.

**No E2E Tests:**
- What's not tested:
  - Full user journey (select scenario → speak → get feedback)
  - Audio recording and transcription flow
  - Modal behavior (suggestions, feedback)
- Risk: Regressions in critical user paths. Unknown if app is usable.
- Action: Add Playwright or Cypress tests. Record real audio samples for testing.

---

*Concerns audit: 2026-03-20*
