import * as groqService from './groq';
import * as geminiService from './gemini';

/**
 * Single switch point for which LLM backend powers the app. Groq stays
 * fully wired up and selectable — set LLM_PROVIDER=groq to fall back to it
 * without touching any call site.
 */
const PROVIDER = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();

const impl = PROVIDER === 'groq' ? groqService : geminiService;

export const getPartnerResponse = impl.getPartnerResponse;
export const getReplySuggestions = impl.getReplySuggestions;
export const evaluateConversation = impl.evaluateConversation;
export const assessProficiency = impl.assessProficiency;
export const classifyUserTurn = impl.classifyUserTurn;
export const getAsideAnswer = impl.getAsideAnswer;
export const detectRoleDrift = impl.detectRoleDrift;

export type TurnKind = groqService.TurnKind;
