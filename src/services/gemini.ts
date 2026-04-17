'use server';

import { GoogleGenAI } from '@google/genai';
import {
  Scenario,
  Message,
  ProficiencyLevel,
  GeminiResponse,
  Evaluation,
  ReplySuggestion,
  ProficiencyAssessment,
} from '@/types';
import { logError } from '@/lib/logger';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Model to use - Gemini 3
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// OpenRouter fallback config
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-4-26b-a4b-it:free';

function toOpenRouterMessages(
  contents: any[],
  systemInstruction?: string
): { role: string; content: string }[] {
  const messages: { role: string; content: string }[] = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  for (const msg of contents) {
    const role = msg.role === 'model' ? 'assistant' : (msg.role ?? 'user');
    const content = Array.isArray(msg.parts)
      ? msg.parts.map((p: any) => p.text ?? '').join('')
      : msg.content ?? '';
    messages.push({ role, content });
  }
  return messages;
}

async function callOpenRouter(options: {
  contents: any[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');

  const { contents, systemInstruction, temperature = 0.7, maxOutputTokens = 200 } = options;
  const messages = toOpenRouterMessages(contents, systemInstruction);

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      temperature,
      max_tokens: maxOutputTokens,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// Backoff windows per REQUIREMENTS.md (attempt N uses index N-1)
const RETRY_WINDOWS_MS: [number, number][] = [
  [2000, 4000], // Attempt 1 retry: 2–4 seconds
  [8000, 16000], // Attempt 2 retry: 8–16 seconds
  [32000, 64000], // Attempt 3 retry: 32–64 seconds (not used — throw after 3 attempts)
];

function isRetryable(error: any): boolean {
  const status = error?.status ?? error?.statusCode ?? error?.code;
  return status === 429 || status === 503 || status === 502;
}

function jitteredDelay([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

// Helper to handle API calls with exponential backoff retry
export async function callGemini(options: {
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
        config: {
          systemInstruction,
          temperature,
          maxOutputTokens,
        },
      });
      return response.text || '';
    } catch (error: any) {
      lastError = error;

      if (!isRetryable(error) || attempt === 2) {
        logError('/api/gemini-call', error, {
          attempt: attempt + 1,
          isRetryable: isRetryable(error),
          status: error?.status ?? error?.statusCode,
        });
        break; // fall through to OpenRouter fallback
      }

      // Retryable error — wait with jittered backoff before next attempt
      const delayRange = RETRY_WINDOWS_MS[attempt];
      const delay = jitteredDelay(delayRange);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Gemini failed — try OpenRouter fallback
  if (OPENROUTER_API_KEY) {
    try {
      return await callOpenRouter(options);
    } catch (fallbackError) {
      logError('/api/openrouter-fallback', fallbackError, {});
    }
  }

  throw lastError;
}

// System prompt for the conversational partner
function buildPartnerSystemPrompt(
  scenario: Scenario,
  proficiencyLevel: ProficiencyLevel
): string {
  const levelInstructions = {
    beginner: `
- Speak slowly and clearly
- Use mostly English with key Yoruba phrases
- Accept single-word or short responses from the user
- Keep your sentences short (under 15 words)
- Be very encouraging and patient
- If the user switches to full English, gently include a Yoruba word or phrase in your response`,
    intermediate: `
- Use a balanced mix of Yoruba and English (about 50/50)
- Expect full sentences from the user
- Introduce common idiomatic expressions
- Keep natural conversation flow
- Wait 2-3 turns before offering any help
- Use code-switching naturally as Nigerians do`,
    advanced: `
- Speak primarily in Yoruba with minimal English
- Use proverbs, idioms, and complex structures when appropriate
- Challenge the user with unexpected turns in conversation
- Rarely offer hints - let them work through difficulties
- Speak at natural speed`,
  };

  return `You are playing a character in a Yoruba language learning exercise.

CHARACTER: ${scenario.aiRole}
SETTING: ${scenario.context}

YOUR BEHAVIOR:
${levelInstructions[proficiencyLevel]}

CRITICAL RULES:
1. NEVER correct the user's grammar or pronunciation during the conversation
2. NEVER break character or mention that this is a learning exercise
3. NEVER use formal lesson language like "let me teach you" or "the correct way is"
4. DO respond naturally to what the user MEANS, even if their grammar is imperfect
5. DO stay in character fully - react as your character would
6. DO keep responses concise (1-3 sentences typically)
7. If the user seems stuck for a long time, you may gently prompt them with a question

LANGUAGE: Respond naturally mixing Yoruba and English as a Nigerian would.

Remember: This is a CONVERSATION, not a lesson. Be natural, be the character.`;
}

// System prompt for silent evaluation
function buildEvaluatorSystemPrompt(): string {
  return `You are a silent evaluator for a Yoruba language learning conversation.

Your job is to analyze the USER's responses ONLY (not the AI partner's).

After analyzing, return a JSON object with this structure:
{
  "strength": "One specific thing the user did well (be concrete, cite their words)",
  "strengthExample": "The exact phrase they used that was good",
  "improvement": "One specific area they could improve (be encouraging)",
  "correctedSentence": "A better way they could have said something, with translation",
  "overallScore": 7,
  "fluencyScore": 6,
  "grammarScore": 7,
  "confidenceScore": 8
}

Scoring guide (1-10):
- 1-3: Struggling, many errors, broken communication
- 4-6: Communicating but with notable room for improvement
- 7-8: Good, natural, minor improvements possible
- 9-10: Excellent, native-like

Be specific in strengths/improvements - never be generic like "good job" or "keep practicing".
Reference actual words and phrases the user said.`;
}

export async function getPartnerResponse(
  scenario: Scenario,
  proficiencyLevel: ProficiencyLevel,
  conversationHistory: Message[],
  userMessage: string
): Promise<GeminiResponse> {
  const systemPrompt = buildPartnerSystemPrompt(scenario, proficiencyLevel);

  // Build conversation context
  const messages = conversationHistory.map((m) => ({
    role: m.role === 'ai' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // Add the new user message
  messages.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  const reply = await callGemini({
    contents: messages,
    systemInstruction: systemPrompt,
    temperature: 0.9,
    maxOutputTokens: 200,
  });

  // Get translation for the response (skip if reply is mostly English)
  let translation = reply;
  try {
    translation = await callGemini({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Translate this to English. Only output the translation, nothing else: "${reply}"`,
            },
          ],
        },
      ],
      temperature: 0.1,
      maxOutputTokens: 200,
    });
  } catch {
    // If translation fails, just use the reply
    translation = reply;
  }

  return {
    reply,
    translation: translation || reply,
  };
}

export async function getReplySuggestions(
  scenario: Scenario,
  proficiencyLevel: ProficiencyLevel,
  conversationHistory: Message[],
  lastAiMessage: string
): Promise<ReplySuggestion[]> {
  const levelHint =
    proficiencyLevel === 'beginner'
      ? 'simple, mostly English with a Yoruba word'
      : proficiencyLevel === 'intermediate'
        ? 'mixed Yoruba-English'
        : 'primarily Yoruba';

  try {
    const text = await callGemini({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `The user is in a Yoruba conversation practice. The AI partner just said: "${lastAiMessage}"

Provide 2 possible responses the user could say. Make them ${levelHint}.

Return as JSON array:
[
  {"text": "response in Yoruba/English mix", "translation": "English translation"},
  {"text": "another response", "translation": "English translation"}
]

Only output the JSON, nothing else.`,
            },
          ],
        },
      ],
      temperature: 0.8,
      maxOutputTokens: 300,
    });

    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Return static fallback suggestions
    return [
      { text: 'Ẹ ṣe o', translation: 'Thank you' },
      { text: 'Báwo ni?', translation: 'How is it?' },
    ];
  }
}

export async function evaluateConversation(
  scenario: Scenario,
  messages: Message[]
): Promise<Evaluation> {
  const systemPrompt = buildEvaluatorSystemPrompt();

  const conversationText = messages
    .map(
      (m) =>
        `${m.role === 'user' ? 'LEARNER' : 'AI PARTNER'}: ${m.content}`
    )
    .join('\n');

  const text = await callGemini({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Evaluate this conversation:\n\n${conversationText}`,
          },
        ],
      },
    ],
    systemInstruction: systemPrompt,
    temperature: 0.3,
    maxOutputTokens: 500,
  });

  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
}

export async function assessProficiency(
  conversationHistory: Message[],
  currentLevel: ProficiencyLevel
): Promise<ProficiencyAssessment> {
  const recent = conversationHistory.slice(-6);
  const userMessages = recent.filter((m) => m.role === 'user');

  if (userMessages.length < 2) {
    return { recommendedLevel: currentLevel, rationale: 'Not enough data yet', confidence: 'low' };
  }

  const conversationText = recent
    .map((m) => `${m.role === 'user' ? 'LEARNER' : 'AI'}: ${m.content}`)
    .join('\n');

  try {
    const text = await callGemini({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are assessing a Yoruba language learner's proficiency. Current level: ${currentLevel}.

Analyze these recent exchanges and recommend a level adjustment only if clearly warranted.

${conversationText}

Return JSON only (no markdown):
{
  "recommendedLevel": "beginner" | "intermediate" | "advanced",
  "rationale": "one concise sentence",
  "confidence": "low" | "high"
}

Set confidence "high" only when the evidence clearly supports a change. Otherwise return the current level with confidence "low".`,
            },
          ],
        },
      ],
      temperature: 0.2,
      maxOutputTokens: 150,
    });

    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as ProficiencyAssessment;
  } catch {
    return { recommendedLevel: currentLevel, rationale: 'Assessment unavailable', confidence: 'low' };
  }
}

export async function translateText(
  text: string,
  targetLanguage: 'english' | 'yoruba'
): Promise<string> {
  try {
    const result = await callGemini({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Translate this to ${targetLanguage}. Only output the translation: "${text}"`,
            },
          ],
        },
      ],
      temperature: 0.1,
      maxOutputTokens: 200,
    });
    return result || text;
  } catch {
    return text;
  }
}
