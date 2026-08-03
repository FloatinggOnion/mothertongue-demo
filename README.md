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
*   Node.js 18+
*   Groq API Key
*   Google Cloud service account with Speech-to-Text + Text-to-Speech APIs enabled
*   Intron API Key (Hausa TTS only)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/mothertongue-demo.git

# 2. Install dependencies
yarn install
or
npm install

# 3. Configure Environment
# Copy .env.example to .env.local and fill in your keys:
cp .env.example .env.local

# 4. Run the development server
yarn dev
or
npm run dev
```

Visit `http://localhost:3000` to interact with the system.

---

*Built with Next.js 15, Tailwind CSS, and Groq (Llama 3.3).*
