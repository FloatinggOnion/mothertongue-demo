# Speech API Migration — Frontend Handover

Backend-only migration: `/api/transcribe` and `/api/tts` now use Google Cloud (Chirp STT for
Yoruba + Hausa, Google TTS for Yoruba) and Intron (TTS for Hausa) instead of the old Modal-hosted
Hausa models. Hausa TTS briefly went through ElevenLabs first but was swapped to Intron after
voice-quality testing — Intron built Hausa as a dedicated local-language TTS model rather than a
generic multilingual model with Hausa bolted on. Igbo is **not** part of this migration — no
vendor found so far has a production-ready Igbo TTS voice, so it stays out of scope.

## TL;DR: no code changes required

The wire contracts for both routes are unchanged:
- `POST /api/transcribe` — same `FormData` in (`audio`, `language: 'yoruba' | 'hausa'`), same JSON
  out (`{ transcription: string }`).
- `POST /api/tts` — same JSON in (`text`, `gender`, `language`), same raw audio bytes out.

`src/hooks/useSpeech.ts` doesn't need edits to keep working.

## One thing worth cleaning up (not urgent, not breaking)

Hausa STT used to be asynchronous (Modal: submit → poll `callId` until `completed`). It's now
synchronous, same as Yoruba already was. `useSpeechRecognition()` in
[`src/hooks/useSpeech.ts:82-118`](src/hooks/useSpeech.ts) branches on `response.status === 202` to
run that polling loop — the backend will never return 202 anymore, so that branch is now dead code
(the `else if (data.transcription)` branch below it already handles both languages correctly).
Safe to delete whenever, doesn't block anything.

## Env vars you'll need locally

`.env.example` was added at the repo root — copy it to `.env.local` and fill in:

```
GROQ_API_KEY=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_CLOUD_PROJECT=
INTRON_API_KEY=
```

`HAUSA_MODAL_STT_URL` / `HAUSA_MODAL_TTS_URL` / `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` are no
longer read anywhere — safe to drop from any `.env.local` you have.

Hausa TTS sends `voice_gender` (`male`/`female`, from the scenario's `gender` field) straight
through to Intron rather than picking between fixed voice IDs — Intron selects the voice for that
gender + `voice_language: 'ha'` itself. Yoruba's Google TTS path is unaffected (still picks
`ssmlGender` per scenario).

**Not live-tested yet**: `voice_language: 'ha'` is confirmed from a verbatim example in Intron's
docs (their tts-queue page's Hausa section). `voice_accent: 'hausa'` is still a best guess — that
same example oddly showed `voice_accent: "swahili"` under the Hausa heading, which looks like a
copy-paste artifact in their docs rather than real guidance, so I didn't copy it. No API key was
available to confirm the correct accent value directly. If Hausa TTS 500s once a real
`INTRON_API_KEY` is in place, check the response body logged by
`[TTS Router] Intron Hausa TTS failed:` in the server console first — that'll have
Intron's actual error message about which field/value it rejected.

## What to smoke-test once the Intron key is in place

- A Hausa scenario's mic button → transcript comes back (via Google Chirp `ha-NG`, unchanged by
  this swap).
- A Hausa scenario's "listen" / AI-speaks button → audio plays (now via Intron, was ElevenLabs
  before that, was Modal VITS originally).
- Yoruba should behave exactly as before, gender wired into voice selection via `ssmlGender`.

## Latency note

[`.planning/debug/process-stops-after-transcription.md`](.planning/debug/process-stops-after-transcription.md)
documents a timing-sensitive completion signal on the drill page that was previously broken by a
latency assumption mismatch. Hausa STT just got *faster and synchronous* (was async Modal polling,
up to 30s cap; now a direct Google Chirp call, same as Yoruba). This should be a net improvement,
but worth a quick spot-check on a real Hausa drill given the history there.

## Igbo

Still shows as a disabled "03 Igbo · Coming Soon" button on the home page
(`src/app/page.tsx`) — untouched, intentionally out of scope for this pass.

## Infra cleanup (not a frontend task, flagging so it doesn't get missed)

The old Modal-hosted Python services (`hausa_stt_service.py`, `hausa_service.py`, `modal_tts.py`,
`populate_cache.py`) have been removed from the repo since nothing calls them anymore. If any of
these are still deployed and running on Modal (`mothertongue-stt-hausa`, `mothertongue-tts-hausa`,
`mothertongue-tts`, `mothertongue-cache-builder`), they should be stopped from the Modal dashboard
or via `modal app stop <name>` to stop GPU billing — that's an account-level action, not something
done as part of this code change.
