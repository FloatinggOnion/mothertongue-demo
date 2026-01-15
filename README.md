# Mothertongue: An Investigation into AI-Mediated Spoken Language Acquisition

**Project Status**: Experimental MVP / Hackathon Submission (Gemini 3)
**Focus**: Low-resource languages (Yorùbá), Output Hypothesis, Cultural Alignment

---

## 📑 Abstract

Mothertongue investigates the efficacy of Large Multimodal Models (LMMs) as real-time conversational partners for language acquisition in low-resource contexts. Specifically, we explore how **Gemini 3** can simulate culturally grounded immersion environments for Yorùbá learners, bridging the gap between passive understanding and active speaking fluency.

This project serves as both a functional MVP for the **Gemini 3 Hackathon** and a proof-of-concept for scalable, culturally-aware AI tutoring systems.

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

To enable this immersion, we architected a low-latency, resilient voice pipeline:

### A. Dual-Engine Speech Recognition
We developed a novel hybrid approach to ensure accessibility across diverse hardware/browsers:
1.  **Primary**: **Native Web Speech API** (Edge/Chrome) for zero-latency, on-device transcription.
2.  **Fallback**: **Server-Side Gemini 3 Transcription**. If the native API fails (e.g., on Arc, Brave, or unreliable networks), the system automatically captures audio via `MediaRecorder` and pipelines it to Gemini 3 for high-fidelity transcription.

### B. Gender-Specific Synthesis
To test the impact of identity on learner engagement, the system dynamically switches TTS voices:
*   **Variable**: Gender alignment with scenario characters.
*   **Tool**: **ElevenLabs** API integration.
*   **Configuration**: Scenarios trigger distinct Voice IDs (e.g., 'Yomi' for male roles, 'Olufunmilola' for female roles) to maintain immersion.

---

## 📊 Current Findings (Hackathon Status)

As of version 0.1.0, the following capabilities have been validated:

### ✅ Experimental Successes
*   **Code-Switching Fluency**: Gemini 3 successfully maintains mixed-language conversations (Yorùbá + English) without hallucinating incorrect grammar, mirroring natural Lagosian speech patterns.
*   **Silent Evaluation**: The "Shadow Evaluator" pattern (running a parallel evaluation agent) provides detailed feedback on fluency and confidence without interrupting the flow of conversation.
*   **Fallback Reliability**: The dual-engine speech system successfully handles browser incompatibility, ensuring a consistent testing environment.

### ⚠️ Limitations & Variables
*   **Latency Overhead**: Server-side transcription adds ~1.5s latency compared to native speech. Future work involves streaming audio to reduce this "turn-taking gap."
*   **Accent Recognition**: Native browser STT struggles with heavy Nigerian accents in mixed-language sentences. Gemini's server-side transcription shows significantly higher accuracy for Yorùbá terms.

---

## 🚀 Future Directions

1.  **Longitudinal Study**: Tracking learner confidence metrics over 30-day cohorts.
2.  **Phonetic Analysis**: Integrating audio-level analysis to provide feedback on Yorùbá tonality (a critical semantic feature).
3.  **Expansion**: Replicating the architecture for Igbo, Hausa, and Nigerian Pidgin.

---

## 💻 Reproduction & Setup

This repository contains the source code for the Mothertongue experimental platform.

### Prerequisites
*   Node.js 18+
*   Gemini API Key
*   ElevenLabs API Key

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/mothertongue-demo.git

# 2. Install dependencies
yarn install
or
npm install

# 3. Configure Environment
# Create .env.local with your keys:
GEMINI_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
ELEVENLABS_VOICE_ID_MALE=your_male_voice_id
ELEVENLABS_VOICE_ID_FEMALE=your_female_voice_id

# 4. Run the development server
yarn dev
or
npm run dev
```

Visit `http://localhost:3000` to interact with the system.

---

*Built with Next.js 15, Tailwind CSS, and Google Gemini 3.*
