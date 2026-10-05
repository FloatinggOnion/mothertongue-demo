# Mothertongue: An Investigation into AI-Mediated Spoken Language Acquisition

**Project Status**: Experimental MVP / Hackathon Submission (Groq)
**Focus**: Low-resource languages (Yorùbá), Output Hypothesis, Cultural Alignment

---

## 📑 Abstract

Mothertongue investigates the efficacy of Large Language Models (LLMs) as real-time conversational partners for language acquisition in low-resource contexts. Specifically, we explore how **Groq's Llama 3.3** can simulate culturally grounded immersion environments for Yorùbá learners, bridging the gap between passive understanding and active speaking fluency.

This project serves as both a functional MVP for the hackathon and a proof-of-concept for scalable, culturally-aware AI tutoring systems.

---

## 🧪 Research Objectives

### 1. The Output Gap
Traditional language apps focus on "Input" (reading/listening). Mothertongue operationalizes Swain's *Output Hypothesis*, positing that acquisition occurs when learners are forced to produce language to convey meaning.
*   **Hypothesis**: An AI partner that tolerates code-switching while gently encouraging comprehensive output can increase learner confidence faster than rigid drills.
*   **Implementation**: Real-time "Speaking Drills" where the AI prioritizes communicative success over grammatical perfection.

### 2. Cultural Alignment & Code-Switching
Can an LLM authentically replicate specific sociolinguistic contexts?
*   **Experiment**: Simulating diverse Nigerian scenarios (e.g., *Agbero* conductors vs. *Mama Àgbà* elders) requires the model to handle distinct registers, honorifics, and the specific Yorùbá-English code-mixture ("Yorunglish") used in Lagos.
*   **Method**: We employ persona-driven prompting strategies to enforce context-specific linguistic behaviors.

---

## 🛠️ System Architecture (Methodology)

To enable this immersion, we architected a resilient voice pipeline split across two providers by language:

### A. Speech Recognition (STT)
All server-side transcription runs through **Google Cloud Speech-to-Text v2 (Chirp)**, for both Yorùbá (`yo-NG`) and Hausa (`ha-NG`). Audio is captured client-side via `MediaRecorder` and posted to `/api/transcribe`, which returns a transcript synchronously. If server-side transcription fails, the client falls back to the browser's native Web Speech API where available.

### B. Speech Synthesis (TTS)
TTS is routed by language, since no single vendor covers both well:
*   **Yorùbá**: **Google Cloud Text-to-Speech** (`yo-NG`), with `ssmlGender` wired to each scenario's `gender` field for male/female voice selection.
*   **Hausa**: **Intron** (`voice_language: 'ha'`) — a dedicated local-language Hausa TTS model, rather than a generic multilingual model with Hausa bolted on.
*   **Igbo**: not yet supported — no vendor evaluated so far offers a production-ready Igbo TTS voice. See `.planning/` for status.

---

## 📊 Current Findings (Hackathon Status)

As of version 0.1.0, the following capabilities have been validated:

### ✅ Experimental Successes
*   **Code-Switching Fluency**: The model successfully maintains mixed-language conversations (Yorùbá + English) without hallucinating incorrect grammar, mirroring natural Lagosian speech patterns.
*   **Silent Evaluation**: The "Shadow Evaluator" pattern (running a parallel evaluation agent) provides detailed feedback on fluency and confidence without interrupting the flow of conversation.
*   **Fallback Reliability**: The dual-engine speech system successfully handles browser incompatibility, ensuring a consistent testing environment.

### ⚠️ Limitations & Variables
*   **Latency Overhead**: Server-side transcription adds ~1.5s latency compared to native speech. Future work involves streaming audio to reduce this "turn-taking gap."
*   **Accent Recognition**: Native browser STT struggles with heavy Nigerian accents in mixed-language sentences. Server-side transcription shows significantly higher accuracy for Yorùbá terms.

---

## 🚀 Future Directions

1.  **Longitudinal Study**: Tracking learner confidence metrics over 30-day cohorts.
2.  **Phonetic Analysis**: Integrating audio-level analysis to provide feedback on Yorùbá tonality (a critical semantic feature).
3.  **Expansion**: Igbo and Nigerian Pidgin remain unsupported pending a viable TTS vendor (Hausa now ships via ElevenLabs).

---

## 💻 Reproduction & Setup

This repository contains the source code for the Mothertongue experimental platform.

### Prerequisites
*   Node.js 22+
*   pnpm 11
*   Groq API Key
*   Google Cloud service account with Speech-to-Text + Text-to-Speech APIs enabled
*   Intron API Key (Hausa TTS only)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/FloatinggOnion/mothertongue-demo.git

# 2. Install dependencies
pnpm install

# 3. Configure Environment
# Copy .env.example to .env.local and fill in your keys:
cp .env.example .env.local

# 4. Run the development server
pnpm dev
```

Visit `http://localhost:3000` to interact with the system.

### Enable saved progress with Clerk

Practice is available without an account. To enable the Save progress action:

1. In your existing Clerk application, open **User & authentication**. Allow email sign-up and sign-in with **email verification codes**. Turn off email links, passwords, phone, passkeys, and social/SSO connections if email codes must be the only option. The prebuilt Clerk forms follow the application's enabled methods.
2. Copy the Clerk publishable and secret keys from **API keys** into `.env.local` as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. Keep the secret key out of Git. Set `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` as shown in `.env.example`.
3. Restart `pnpm dev`. Practice a scenario, select **Save progress**, complete the email-code flow, then visit **My progress**. Add the same keys to your hosting provider's environment before deploying; use production Clerk keys for the live domain.

Saved progress currently consists of scenario summaries and level. Conversation transcripts remain in the current browser and cannot yet be resumed on another device.

### Enable web measurement for the learner pilot

The [measurement plan](.planning/WEB-MEASUREMENT-PLAN.md) puts conversation coherence first. The code ships with both collection switches off. The privacy notice is at `/privacy`, with `jesseosems123@gmail.com` as the contact address. This setup covers the **web app only**.

1. Create a dedicated **Mothertongue** project in PostHog Free. If your existing PostHog team belongs to another organization, use an organization you control for this project so the other team's members and usage are separate. Add the new project's key to `POSTHOG_PROJECT_KEY` and its matching `https://us.i.posthog.com` or `https://eu.i.posthog.com` ingest URL to `POSTHOG_HOST` in Vercel. Do not enable PostHog autocapture or session replay. Set `NEXT_PUBLIC_ANALYTICS_ENABLED=true` only when ready to collect structured events. The app sends events from its own server route and never sends conversation text to PostHog.
2. Create a **Neon Free** project. Run [`neon/migrations/20261005_conversation_reviews.sql`](neon/migrations/20261005_conversation_reviews.sql) in its SQL editor. Add its pooled Postgres connection string as `NEON_DATABASE_URL` in Vercel. Keep the URL server-side; never prefix it `NEXT_PUBLIC_`. Set a long random `CRON_SECRET` in Vercel so the daily deletion route can run. Finally set `NEXT_PUBLIC_RESEARCH_SHARING_ENABLED=true`. The server refuses shares if the cleanup secret is absent.
3. Deploy and verify on the live domain: start a scenario without signing in; finish it; confirm the sharing choice starts unchecked; choose **under 18** and confirm sharing is unavailable; choose **18 or older**, check the separate consent box, share a test conversation, and save its deletion receipt. Confirm the row appears in Neon without a Clerk ID or email, then delete it using `/privacy` and confirm the row disappears. Inspect PostHog for structured event names and no message text. Check the Vercel cron after its next run.

This repository's [`pnpm-workspace.yaml`](pnpm-workspace.yaml) records reviewed pnpm 11 dependency build decisions. `pnpm install --frozen-lockfile` should run noninteractively on Vercel without `ERR_PNPM_IGNORED_BUILDS`; keep pnpm and the lockfile together when deploying.

The sharing route schedules rows to expire on day 29; the daily Vercel cron removes expired rows by day 30 when it runs normally. Monitor cron failures, and manually delete expired rows if a scheduled run fails. Keep sharing disabled if the deletion job is not working. In PostHog, start with a funnel from `scenario_started` to `learner_turn_sent` and `session_finished`, a trend of `reply_understood` grouped by `answer`, and reply failure/latency trends grouped by language. The current first pilot has session-level pseudonymous metrics; account-level linkage and a formal reviewer dashboard are still pending.

---

*Built with Next.js 16 and Tailwind CSS.*
