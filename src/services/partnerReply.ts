import { Message, ProficiencyLevel } from '@/types';
import { hasHeuristicRoleDrift } from './promptLib';
import { translateToEnglish, getPartnerResponse as getGeminiPartnerResponse } from './gemini';

/**
 * Shared machinery for the small African-language partner models (Morena,
 * Tiny Aya): a strict gate on each raw reply, resampling on rejection, and a
 * Gemini fallback so the learner never sees an error.
 */

/** Attempts per turn before giving up; each rejected reply is resampled. */
const MAX_ATTEMPTS = 3;

const MAX_SENTENCES: Record<ProficiencyLevel, number> = { beginner: 1, intermediate: 2, advanced: 3 };
const MAX_CHARS: Record<ProficiencyLevel, number> = { beginner: 160, intermediate: 280, advanced: 450 };
export const MAX_NEW_TOKENS: Record<ProficiencyLevel, number> = { beginner: 64, intermediate: 96, advanced: 128 };
export const SENTENCE_HINT: Record<ProficiencyLevel, string> = {
  beginner: 'in one short sentence',
  intermediate: 'in one or two short sentences',
  advanced: 'in two or three sentences',
};

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

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Keeps up to `max` sentences, not counting short interjections: Tiny Aya
 * often opens with "Daalụ!" or "Na gode!" before the actual answer, and a
 * plain one-sentence cut kept only the interjection.
 */
function truncateSentences(sentences: string[], max: number): string {
  const kept: string[] = [];
  let counted = 0;
  for (const s of sentences) {
    if (counted >= max) break;
    kept.push(s);
    if (words(s).length >= 3) counted++;
  }
  return kept.join(' ');
}

export type ReplyCheck = { reply: string; reason: 'ok' } | { reply: null; reason: string };

/**
 * Strict gate on a raw partner reply. Small models rarely stop after their
 * turn — they run on into invented dialogue, markup or code — so only the
 * first line is kept, and anything that isn't a clean, in-character,
 * target-language utterance is rejected so the caller can resample.
 */
export function checkPartnerReply(
  raw: string,
  opts: { level: ProficiencyLevel; userMessage: string; scenario?: any }
): ReplyCheck {
  let text = raw.trim().split('\n')[0].trim();

  // Tiny Aya sometimes prefixes its own name ("Mama Rabi: ..."); that label is
  // harmless, so strip it. Any other label is still rejected below.
  const ownName = String(opts.scenario?.aiRole || '').split(',')[0].trim();
  if (ownName) text = text.replace(new RegExp(`^${escapeRegExp(ownName)}\\s*:\\s*`, 'i'), '');

  if (text.length < 2) return { reply: null, reason: 'empty' };
  // Parentheses are always glosses or stage directions, e.g. "àtààrò (tomatoes)".
  if (/[<>{}[\]()*_#|\\]/.test(text)) return { reply: null, reason: 'markup' };
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

  text = truncateSentences(sentences, MAX_SENTENCES[opts.level]);
  if (text.length > MAX_CHARS[opts.level]) return { reply: null, reason: 'too-long' };
  // A trailing colon means the content (usually a list) was on the lines we dropped.
  if (text.endsWith(':')) return { reply: null, reason: 'incomplete' };
  if (englishRatio(text) > MAX_ENGLISH_RATIO) return { reply: null, reason: 'english' };

  return { reply: text, reason: 'ok' };
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

/** Maps app history plus the new user line into plain chat turns. */
export function toChatTurns(history: Message[], userMessage: string): ChatTurn[] {
  return [
    ...history.map((msg): ChatTurn => ({
      role: msg.role === 'ai' ? 'assistant' : 'user',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];
}

/**
 * Samples a reply from `generate` until one passes checkPartnerReply, then
 * translates it. Rejections are correlated (the same prompt tends to fail the
 * same way on every retry), so after MAX_ATTEMPTS — or on any provider error —
 * the turn falls back to Gemini instead of showing an error.
 */
export async function runCheckedPartnerTurn(args: {
  label: string;
  generate: () => Promise<string>;
  scenario: any;
  level: ProficiencyLevel;
  history: Message[];
  userMessage: string;
  language: string;
}) {
  const { label, generate, scenario, level, history, userMessage, language } = args;
  try {
    let replyText: string | null = null;
    const rejected: string[] = [];
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !replyText; attempt++) {
      const check = checkPartnerReply(await generate(), { level, userMessage, scenario });
      if (check.reply) replyText = check.reply;
      else rejected.push(check.reason);
    }
    if (rejected.length) console.warn(`[${label}] rejected ${rejected.length} reply(s): ${rejected.join(', ')}`);
    if (!replyText) throw new Error(`No acceptable reply after ${MAX_ATTEMPTS} attempts`);

    const translation = await translateToEnglish(replyText, language);
    return { reply: replyText, translation };
  } catch (error) {
    console.error(`${label} error, falling back to Gemini for this turn:`, error);
    return getGeminiPartnerResponse(scenario, level, history, userMessage, language);
  }
}
