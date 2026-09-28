import * as groqService from './groq';
import * as geminiService from './gemini';
import * as morenaService from './morena';
import * as ayaService from './aya';

/**
 * Single switch point for which LLM backend powers the app.
 *
 * LLM_PROVIDER=gemini (default) — Gemini on Vertex AI for all functions
 * LLM_PROVIDER=groq              — Groq for all functions
 * LLM_PROVIDER=morena            — Morena 1.5B on Modal for getPartnerResponse;
 *                                  Gemini handles the remaining structured-output
 *                                  tasks (eval, suggestions, classification, etc.)
 *                                  Note: Gemini credentials are still required.
 * LLM_PROVIDER=aya               — Tiny Aya (Cohere API) for getPartnerResponse;
 *                                  Gemini for everything else.
 * LLM_PROVIDER=hybrid            — getPartnerResponse picks a model per language
 *                                  (PARTNER_BY_LANGUAGE: Tiny Aya for Hausa and
 *                                  Igbo, Gemini for Yoruba); Gemini for everything else.
 */
const PROVIDER = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

const baseImpl = PROVIDER === 'groq' ? groqService : geminiService;

/**
 * Partner model per language for LLM_PROVIDER=hybrid. From a head-to-head on
 * the live endpoints (2026-09-28): Tiny Aya Earth stayed in role and answered
 * on-topic in Hausa and Igbo; in Yoruba it misread questions. Morena did better
 * there but its scaled-to-zero cold start reached ~100 s, so Yoruba stays on
 * Gemini pending native-speaker review. Unlisted languages use Gemini.
 */
const PARTNER_BY_LANGUAGE: Record<string, typeof geminiService.getPartnerResponse> = {
  yoruba: geminiService.getPartnerResponse,
  hausa: ayaService.getPartnerResponse,
  igbo: ayaService.getPartnerResponse,
};

const getHybridPartnerResponse: typeof geminiService.getPartnerResponse = (
  scenario, proficiencyLevel, conversationHistory, userMessage, language
) => {
  const lang = (language || scenario?.language || '').toLowerCase();
  const impl = PARTNER_BY_LANGUAGE[lang] ?? geminiService.getPartnerResponse;
  return impl(scenario, proficiencyLevel, conversationHistory, userMessage, language);
};

export const getPartnerResponse =
  PROVIDER === 'morena' ? morenaService.getPartnerResponse
  : PROVIDER === 'aya' ? ayaService.getPartnerResponse
  : PROVIDER === 'hybrid' ? getHybridPartnerResponse
  : baseImpl.getPartnerResponse;
export const getReplySuggestions = baseImpl.getReplySuggestions;
export const evaluateConversation = baseImpl.evaluateConversation;
export const assessProficiency = baseImpl.assessProficiency;
export const classifyUserTurn = baseImpl.classifyUserTurn;
export const getAsideAnswer = baseImpl.getAsideAnswer;
export const detectRoleDrift = baseImpl.detectRoleDrift;

export type TurnKind = groqService.TurnKind;
