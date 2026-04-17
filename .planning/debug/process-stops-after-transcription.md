---
status: awaiting_human_verify
trigger: "process silently stops after STT transcription completes, before AI response or TTS playback"
created: 2026-04-18T00:00:00Z
updated: 2026-04-18T00:02:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED AND FIXED
test: TypeScript compilation passes with zero errors
expecting: voice pipeline now waits for actual transcription to complete before reading transcript and calling sendMessage
next_action: human verification — test voice conversation end-to-end

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: After STT transcription → AI processes text → TTS plays spoken response
actual: Process silently stops after transcription — no error, no response, no TTS
errors: No visible browser console errors when it fails
reproduction: Use the voice conversation feature on desktop or mobile web
started: Rarely works now (<20% success rate), previously worked more reliably

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: API/LLM rate limiting or auth errors cause silent failure
  evidence: errors.log shows rate limit errors for gemini-2.5-flash (old direct Gemini API), but current code uses OpenRouter with retry logic; OpenRouter errors would throw and be caught in sendMessage's catch block, logging "Failed to get AI response" — this does not explain <20% success because sendMessage never runs
  timestamp: 2026-04-18T00:01:00Z

- hypothesis: sendMessage swallows API errors silently
  evidence: sendMessage has try/catch that logs errors and always calls setIsLoading(false). When API returns error JSON (data.error), it logs to console but does NOT call speak(). However this only matters if sendMessage is called at all.
  timestamp: 2026-04-18T00:01:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-18T00:01:00Z
  checked: useSpeech.ts — mediaRecorder.onstop handler (lines 53-79)
  found: onstop is async. It calls fetch('/api/transcribe'), waits for the response, then calls setTranscript(). This is a React setState call — transcript state is NOT updated synchronously.
  implication: transcript state update is scheduled for the NEXT render cycle, not immediately available

- timestamp: 2026-04-18T00:01:00Z
  checked: drill/[id]/page.tsx — handleMicRelease (lines 243-262)
  found: handleMicRelease calls stopListening(), waits 300ms, then reads transcript from React state closure. The 300ms setTimeout was intended to wait for the "final transcript" but the transcription is a full server-side fetch to /api/transcribe. The fetch takes much longer than 300ms in any real network condition.
  implication: handleMicRelease reads transcript BEFORE the async fetch in onstop completes. It gets the PREVIOUS or EMPTY transcript value. Then it calls resetTranscript() (clearing even that), and since userText is empty, skips sendMessage entirely. Process silently stops.

- timestamp: 2026-04-18T00:01:00Z
  checked: handleMicRelease useCallback dependency array
  found: transcript is in the dependency array, which means it captures the transcript value at the time the callback was last created. Even if state updated, the callback closure would hold stale state until re-render.
  implication: Double stale read — both the timing race AND the closure stale value problem combine to guarantee transcript is empty in handleMicRelease.

- timestamp: 2026-04-18T00:01:00Z
  checked: logs/errors.log
  found: Older errors show gemini-2.5-flash rate limits (April 15). Current code (gemini.ts) uses OpenRouter with retry. No errors logged from /api/chat meaning sendMessage is never reaching the API at all.
  implication: Confirms the pipeline dies before sendMessage is ever called.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Race condition in handleMicRelease: it reads `transcript` React state 300ms after stopListening(), but the STT pipeline is async (microphone → MediaRecorder onstop → fetch /api/transcribe → setTranscript). The server-side transcription fetch takes hundreds of milliseconds to seconds. The 300ms wait is far too short. Additionally, transcript is captured in a useCallback closure, so even if state updated within 300ms, the stale closure value would still be empty. handleMicRelease always reads empty string, skips sendMessage, and the pipeline silently stops.
fix: |
  Added two refs (transcriptReadyResolveRef, processingStartedRef) and a useEffect in page.tsx.
  The useEffect watches interimTranscript: when it transitions from 'Processing audio...' back to '',
  it resolves the pending Promise with the current transcript value. handleMicRelease now awaits
  that Promise instead of a fixed 300ms timeout, so sendMessage only runs after transcription
  is truly complete. A 10s safety timeout prevents infinite hangs. STT and TTS code are untouched.
verification: TypeScript compilation passes with zero errors (npx tsc --noEmit)
files_changed: [src/app/drill/[id]/page.tsx]
