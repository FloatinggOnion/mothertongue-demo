import { Message, ProficiencyLevel } from '@/types';
import { langDisplayName } from './promptLib';
import { MAX_NEW_TOKENS, SENTENCE_HINT, ChatTurn, runCheckedPartnerTurn, toChatTurns } from './partnerReply';

export type TurnKind = 'roleplay' | 'aside';

const MODAL_URL = process.env.MORENA_MODAL_URL;

async function callModal(systemPrompt: string, messages: ChatTurn[], maxNewTokens: number): Promise<string> {
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

/**
 * Morena is a 1.5B model: the long Gemini-style partner prompt (and its JSON
 * example) made it copy the example and lose its role. Measured against the
 * live endpoint, a one-line prompt did best; a native-language prompt scored
 * the same but swapped roles more often.
 */
export function buildMorenaSystemPrompt(scenario: any, level: ProficiencyLevel, language: string): string {
  const role = scenario?.aiRole || 'a conversation partner';
  return `You are ${role}. Answer the user's latest meaning in ${langDisplayName(language)}, ${SENTENCE_HINT[level]}. Stay in the scene.`;
}

export async function getPartnerResponse(
  scenario: any,
  proficiencyLevel: ProficiencyLevel,
  conversationHistory: Message[],
  userMessage: string,
  language?: string
) {
  const activeLang = language || scenario?.language || 'yoruba';
  const systemPrompt = buildMorenaSystemPrompt(scenario, proficiencyLevel, activeLang);
  const messages = toChatTurns(conversationHistory, userMessage);

  return runCheckedPartnerTurn({
    label: 'Morena',
    generate: () => callModal(systemPrompt, messages, MAX_NEW_TOKENS[proficiencyLevel]),
    scenario,
    level: proficiencyLevel,
    history: conversationHistory,
    userMessage,
    language: activeLang,
  });
}
