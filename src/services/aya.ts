import { Message, ProficiencyLevel } from '@/types';
import { langDisplayName } from './promptLib';
import { MAX_NEW_TOKENS, SENTENCE_HINT, ChatTurn, runCheckedPartnerTurn, toChatTurns } from './partnerReply';

/**
 * Cohere Tiny Aya (3.35B) via the Cohere Chat API. `tiny-aya-earth` is the
 * variant tuned for African and West Asian languages. The open weights are
 * CC-BY-NC; production use goes through the paid Cohere API.
 */
const COHERE_CHAT_URL = 'https://api.cohere.com/v2/chat';
const MODEL = process.env.COHERE_PARTNER_MODEL || 'tiny-aya-earth';

// Measured on the live API: at the model card's example temperature (0.1) the
// replies collapsed to bare greetings ("Daalụ!") and never answered questions;
// 0.7 gave in-character, on-topic answers.
const TEMPERATURE = 0.7;

async function callCohere(systemPrompt: string, messages: ChatTurn[], maxTokens: number): Promise<string> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) throw new Error('COHERE_API_KEY is not set');

  const res = await fetch(COHERE_CHAT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });

  if (!res.ok) throw new Error(`Cohere API returned ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.message?.content?.[0]?.text ?? '';
}

/**
 * Unlike Morena, Tiny Aya makes use of the scene context. The scenario text
 * addresses the learner as "you", so the prompt says so explicitly to keep
 * the model from taking the learner's side.
 */
export function buildAyaSystemPrompt(scenario: any, level: ProficiencyLevel, language: string): string {
  const role = scenario?.aiRole || 'a conversation partner';
  const lang = langDisplayName(language);
  const context = String(scenario?.context || '').split(/\s+/).join(' ').trim();
  return [
    `You are ${role}, in a roleplay for a ${lang} language learner.`,
    `Scene: ${scenario?.description || 'A conversation'}. ${context}`,
    `(In the scene text, "you" means the learner; you are ${role}.)`,
    `Stay in character as ${role}. Reply only in ${lang}, ${SENTENCE_HINT[level]}, and never speak for the learner.`,
  ].join('\n');
}

export async function getPartnerResponse(
  scenario: any,
  proficiencyLevel: ProficiencyLevel,
  conversationHistory: Message[],
  userMessage: string,
  language?: string
) {
  const activeLang = language || scenario?.language || 'hausa';
  const systemPrompt = buildAyaSystemPrompt(scenario, proficiencyLevel, activeLang);
  const messages = toChatTurns(conversationHistory, userMessage);

  return runCheckedPartnerTurn({
    label: 'Tiny Aya',
    generate: () => callCohere(systemPrompt, messages, MAX_NEW_TOKENS[proficiencyLevel]),
    scenario,
    level: proficiencyLevel,
    history: conversationHistory,
    userMessage,
    language: activeLang,
  });
}
