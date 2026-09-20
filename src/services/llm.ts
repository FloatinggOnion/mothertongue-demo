import * as groqService from './groq';
import * as geminiService from './gemini';
import * as morenaService from './morena';

/**
 * Single switch point for which LLM backend powers the app.
 *
 * LLM_PROVIDER=gemini (default) — Gemini on Vertex AI for all functions
 * LLM_PROVIDER=groq              — Groq for all functions
 * LLM_PROVIDER=morena            — Morena 1.5B on Modal for getPartnerResponse;
 *                                  Gemini handles the remaining structured-output
 *                                  tasks (eval, suggestions, classification, etc.)
 *                                  Note: Gemini credentials are still required.
 */
const PROVIDER = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

const baseImpl = PROVIDER === 'groq' ? groqService : geminiService;

export const getPartnerResponse =
  PROVIDER === 'morena' ? morenaService.getPartnerResponse : baseImpl.getPartnerResponse;
export const getReplySuggestions = baseImpl.getReplySuggestions;
export const evaluateConversation = baseImpl.evaluateConversation;
export const assessProficiency = baseImpl.assessProficiency;
export const classifyUserTurn = baseImpl.classifyUserTurn;
export const getAsideAnswer = baseImpl.getAsideAnswer;
export const detectRoleDrift = baseImpl.detectRoleDrift;

export type TurnKind = groqService.TurnKind;
