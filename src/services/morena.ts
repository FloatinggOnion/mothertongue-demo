import { Message, ProficiencyLevel } from '@/types';
import { buildPartnerSystemPrompt } from './promptLib';
import { translateToEnglish } from './gemini';

export type TurnKind = 'roleplay' | 'aside';

const MODAL_URL = process.env.MORENA_MODAL_URL;

async function callModal(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  maxNewTokens = 200
): Promise<string> {
  if (!MODAL_URL) throw new Error('MORENA_MODAL_URL is not set');

  const res = await fetch(MODAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_prompt: systemPrompt,
      messages,
      max_new_tokens: maxNewTokens,
      ...(process.env.MORENA_ENDPOINT_SECRET
        ? { x_api_key: process.env.MORENA_ENDPOINT_SECRET }
        : {}),
    }),
  });

  if (!res.ok) throw new Error(`Modal endpoint returned ${res.status}`);
  const data = await res.json();
  return data.text ?? '';
}

// Morena is a 1.5B model that may not reliably output strict JSON.
// Try JSON parse first, then regex extraction, then raw text.
function extractReply(rawText: string): string {
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed.reply === 'string') return parsed.reply;
  } catch {}

  const m = rawText.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m) return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');

  return rawText.trim();
}

export async function getPartnerResponse(
  scenario: any,
  proficiencyLevel: ProficiencyLevel,
  conversationHistory: Message[],
  userMessage: string,
  language?: string
) {
  const activeLang = language || scenario?.language || 'yoruba';
  const systemPrompt = buildPartnerSystemPrompt(scenario, proficiencyLevel, activeLang);

  const messages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role === 'ai' ? 'assistant' : 'user',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    const rawText = await callModal(systemPrompt, messages, 200);
    const replyText = extractReply(rawText);
    const translation = await translateToEnglish(replyText, activeLang);
    return { reply: replyText, translation };
  } catch (error) {
    console.error('Morena error:', error);
    return {
      reply:
        activeLang.toLowerCase() === 'hausa'
          ? 'Gafara gani, wani abu ya faru da kuskure.'
          : activeLang.toLowerCase() === 'igbo'
          ? 'Ndo, ihe ọjọọ mere.'
          : 'E binu, nkankan ko tọ lẹnu igbiyanju mi.',
      translation: 'Apologies, something went wrong.',
    };
  }
}
