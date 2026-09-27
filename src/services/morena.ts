import { Message, ProficiencyLevel } from '@/types';
import { hasHeuristicRoleDrift, langDisplayName } from './promptLib';
import { translateToEnglish, getPartnerResponse as getGeminiPartnerResponse } from './gemini';

export type TurnKind = 'roleplay' | 'aside';

const MODAL_URL = process.env.MORENA_MODAL_URL;

/** Attempts per turn before giving up; each rejected reply is resampled. */
const MAX_ATTEMPTS = 3;

const MAX_SENTENCES: Record<ProficiencyLevel, number> = { beginner: 1, intermediate: 2, advanced: 3 };
const MAX_CHARS: Record<ProficiencyLevel, number> = { beginner: 160, intermediate: 280, advanced: 450 };
const MAX_NEW_TOKENS: Record<ProficiencyLevel, number> = { beginner: 64, intermediate: 96, advanced: 128 };
const SENTENCE_HINT: Record<ProficiencyLevel, string> = {
  beginner: 'in one short sentence',
  intermediate: 'in one or two short sentences',
  advanced: 'in two or three sentences',
};

async function callModal(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  maxNewTokens: number
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

/**
 * Morena is a 1.5B model: the long Gemini-style partner prompt (and its JSON
 * example) made it copy the example and lose its role. Measured against the
 * live endpoint, a one-line prompt did best; a native-language prompt scored
 * the same but swapped roles more often.
 */
export function buildMorenaSystemPrompt(scenario: any, level: ProficiencyLevel, language: string): string {
  const role = scenario?.aiRole || 'a conversation partner';
  return `You are ${role}. Reply to the user in ${langDisplayName(language)}, ${SENTENCE_HINT[level]}.`;
}

// Common English words that don't collide with Yoruba, Hausa or Igbo words.
const ENGLISH_WORDS = new Set(
  `the is are was were you your yours my and with this that these those what how have has
  very good morning evening afternoon please pleased meet thank thanks today fresh price for of it its
  we they will would can could do does not but here there like want buy sell sorry welcome hello
  come journey about just best get make look tired work i'm it's don't i'll you're`.split(/\s+/)
);
const MAX_ENGLISH_RATIO = 0.25;

const words = (t: string) => t.toLowerCase().match(/\p{L}+(?:'\p{L}+)?/gu) ?? [];

function englishRatio(text: string): number {
  const w = words(text);
  return w.length ? w.filter((x) => ENGLISH_WORDS.has(x)).length / w.length : 0;
}

/** True if any 3+ word sentence of `reply` nearly matches a sentence of `other`. */
function echoes(reply: string, other: string): boolean {
  const sentences = (t: string) =>
    t.split(/[.!?]+\s*/).map((s) => new Set(words(s))).filter((s) => s.size >= 3);
  const theirs = sentences(other);
  return sentences(reply).some((a) =>
    theirs.some((b) => {
      const shared = [...a].filter((x) => b.has(x)).length;
      return shared / Math.min(a.size, b.size) >= 0.8;
    })
  );
}

export type ReplyCheck = { reply: string; reason: 'ok' } | { reply: null; reason: string };

/**
 * Strict gate on raw Morena output. The model rarely stops after its turn —
 * it runs on into invented dialogue, markup or code — so only the first line
 * is kept, and anything that isn't a clean, in-character, target-language
 * utterance is rejected so the caller can resample.
 */
export function checkMorenaReply(
  raw: string,
  opts: { level: ProficiencyLevel; userMessage: string; scenario?: any }
): ReplyCheck {
  let text = raw.trim().split('\n')[0].trim();

  if (text.length < 2) return { reply: null, reason: 'empty' };
  if (/[<>{}[\]*_#|\\]/.test(text)) return { reply: null, reason: 'markup' };
  if (/^[^\s:]{1,30}(\s[^\s:]{1,30}){0,3}\s*:/u.test(text)) return { reply: null, reason: 'speaker-label' };
  if (/\b(as an ai|language model|translation|translate)\b/i.test(text)) return { reply: null, reason: 'meta' };

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const normalized = sentences.map((s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''));
  if (new Set(normalized).size < normalized.length) return { reply: null, reason: 'repetition' };

  // Restating its own earlier line is allowed: asked "what do you have?", repeating
  // the menu from the opener is a correct answer, and rejecting it failed every retry.
  // Judge echo and drift on the whole line, before truncation: a copied user
  // line whose first sentence is short would otherwise slip through trimmed.
  if (echoes(text, opts.userMessage)) return { reply: null, reason: 'echo-user' };
  if (hasHeuristicRoleDrift(text, opts.scenario)) return { reply: null, reason: 'role-drift' };

  text = sentences.slice(0, MAX_SENTENCES[opts.level]).join(' ');
  if (text.length > MAX_CHARS[opts.level]) return { reply: null, reason: 'too-long' };
  if (englishRatio(text) > MAX_ENGLISH_RATIO) return { reply: null, reason: 'english' };

  return { reply: text, reason: 'ok' };
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

  const messages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role === 'ai' ? 'assistant' : 'user',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    let replyText: string | null = null;
    const rejected: string[] = [];
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !replyText; attempt++) {
      const raw = await callModal(systemPrompt, messages, MAX_NEW_TOKENS[proficiencyLevel]);
      const check = checkMorenaReply(raw, { level: proficiencyLevel, userMessage, scenario });
      if (check.reply) replyText = check.reply;
      else rejected.push(check.reason);
    }
    if (rejected.length) console.warn(`[Morena] rejected ${rejected.length} reply(s): ${rejected.join(', ')}`);
    if (!replyText) throw new Error(`No acceptable reply after ${MAX_ATTEMPTS} attempts`);

    const translation = await translateToEnglish(replyText, activeLang);
    return { reply: replyText, translation };
  } catch (error) {
    // Rejections are correlated (the same prompt tends to fail the same way on
    // every retry), so rather than show an error the turn falls back to Gemini.
    console.error('Morena error, falling back to Gemini for this turn:', error);
    return getGeminiPartnerResponse(scenario, proficiencyLevel, conversationHistory, userMessage, activeLang);
  }
}
