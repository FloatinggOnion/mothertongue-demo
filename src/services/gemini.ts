import { GoogleGenAI } from '@google/genai';
import { Message, ProficiencyLevel, ReplySuggestion, Evaluation, ProficiencyAssessment } from '@/types';
import {
  buildPartnerSystemPrompt,
  buildRoleReinforcement,
  hasHeuristicRoleDrift,
  DRIFT_LLM_CHECK_THRESHOLD,
  ASIDE_PATTERNS,
  buildDriftCheckSystemPrompt,
  buildClassifyTurnSystemPrompt,
  buildAsideAnswerSystemPrompt,
  buildReplySuggestionsSystemPrompt,
  buildEvaluationSystemPrompt,
  buildProficiencyAssessmentSystemPrompt,
  buildTranslationSystemPrompt,
} from './promptLib';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';

type GeminiContent = { role: 'user' | 'model'; parts: { text: string }[] };

let client: GoogleGenAI | null = null;

/**
 * Lazily constructs a singleton Vertex AI client, reusing the same
 * Google Cloud service-account credentials already configured for the
 * Speech-to-Text and Text-to-Speech services.
 */
function getGeminiClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
      googleAuthOptions: {
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
      },
    });
  }
  return client;
}

/**
 * Helper to format application message history into Gemini's `contents`
 * shape. Gemini uses 'model' (not 'assistant') for the AI turn role.
 */
function formatGeminiHistory(history: Message[]): GeminiContent[] {
  return history.map((msg) => ({
    role: msg.role === 'ai' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));
}

/**
 * Gemini's `contents` array only supports 'user'/'model' roles — there is
 * no mid-conversation system turn. Operator-level asides (the role-drift
 * reinforcement reminder, the corrective retry note) are folded into a
 * clearly-labeled 'user' turn instead, so they still land in the prompt
 * without being mistaken for something the learner said.
 */
function systemAside(text: string): GeminiContent {
  return { role: 'user', parts: [{ text: `[SYSTEM NOTE — an instruction from the app, not the human user] ${text}` }] };
}

/**
 * Sends a generateContent request to Gemini on Vertex AI and returns the
 * raw text output.
 */
async function callGemini(
  systemPrompt: string,
  contents: GeminiContent[],
  options: { json?: boolean; temperature?: number } = {}
): Promise<string> {
  const { json = false, temperature = 0.7 } = options;

  try {
    const response = await getGeminiClient().models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    });
    return response.text || '';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini API Error: ${message}`);
  }
}

/**
 * Detects whether a generated partner reply has drifted into voicing the
 * user's side of the conversation. Stage 1 is a free heuristic that always
 * runs. Stage 2 (a single cheap Gemini call) only fires when the heuristic
 * is clean AND the conversation is long enough that drift risk justifies
 * the cost. Any failure in the LLM check resolves to false — never block a
 * valid reply on a failed check.
 */
export async function detectRoleDrift(
  reply: string,
  scenario: any,
  historyLength: number
): Promise<boolean> {
  if (hasHeuristicRoleDrift(reply, scenario)) {
    return true;
  }

  if (historyLength < DRIFT_LLM_CHECK_THRESHOLD) {
    return false;
  }

  const aiRole = scenario?.aiRole || 'Conversation Partner';
  const systemPrompt = buildDriftCheckSystemPrompt(aiRole);

  try {
    const rawText = await callGemini(
      systemPrompt,
      [{ role: 'user', parts: [{ text: reply }] }],
      { json: true, temperature: 0 }
    );
    const parsed = JSON.parse(rawText || '{}');
    return parsed.voicedUser === true;
  } catch (error) {
    console.error('Error detecting role drift:', error);
    return false;
  }
}

export type TurnKind = 'roleplay' | 'aside';

/**
 * Classifies a user's turn as either an in-character roleplay line or an
 * out-of-character meta question ("aside") about the language itself.
 *
 * Stage 1 is a free heuristic regex match. Stage 2 falls back to a single
 * cheap Gemini call when the heuristic doesn't match. Fail-safe direction:
 * any error, empty content, or unrecognized value resolves to 'roleplay' —
 * misrouting a roleplay line breaks the scene, whereas a missed aside is
 * recoverable via the manual Ask button.
 */
export async function classifyUserTurn(userMessage: string, language?: string): Promise<TurnKind> {
  if (ASIDE_PATTERNS.some((pattern) => pattern.test(userMessage))) {
    return 'aside';
  }

  const systemPrompt = buildClassifyTurnSystemPrompt(language);

  try {
    const rawText = await callGemini(
      systemPrompt,
      [{ role: 'user', parts: [{ text: userMessage }] }],
      { json: true, temperature: 0 }
    );
    const parsed = JSON.parse(rawText || '{}');
    return parsed.kind === 'aside' ? 'aside' : 'roleplay';
  } catch (error) {
    console.error('Error classifying user turn:', error);
    return 'roleplay';
  }
}

/**
 * Answers a learner's out-of-character side question in plain English,
 * completely out of the roleplay thread. Deliberately history-free — only
 * the question itself is sent — so asides can never leak into the
 * scenario transcript.
 */
export async function getAsideAnswer(
  userQuestion: string,
  scenario: any,
  proficiencyLevel: ProficiencyLevel,
  language?: string
): Promise<{ answer: string }> {
  const activeLang = language || scenario?.language || 'yoruba';
  const systemPrompt = buildAsideAnswerSystemPrompt(proficiencyLevel, activeLang);

  try {
    const rawText = await callGemini(
      systemPrompt,
      [{ role: 'user', parts: [{ text: userQuestion }] }],
      { json: true, temperature: 0.3 }
    );
    const parsed = JSON.parse(rawText || '{}');
    return { answer: parsed.answer || "Sorry — I couldn't look that up just now. Try asking again." };
  } catch (error) {
    console.error('Error generating aside answer:', error);
    return { answer: "Sorry — I couldn't look that up just now. Try asking again." };
  }
}

/**
 * Generates the AI partner's conversational response and seamlessly translates it to English.
 */
export async function getPartnerResponse(
  scenario: any,
  proficiencyLevel: ProficiencyLevel,
  conversationHistory: Message[],
  userMessage: string,
  language?: string
) {
  const activeLang = language || scenario?.language || 'yoruba';
  const aiRole = scenario?.aiRole || 'Conversation Partner';
  const systemPrompt = buildPartnerSystemPrompt(scenario, proficiencyLevel, activeLang);

  const contents: GeminiContent[] = [...formatGeminiHistory(conversationHistory)];

  // Periodic reinforcement: on longer histories, insert a recency-biased
  // reminder immediately before the newest user turn — it survives long
  // histories better than the far-away opening system prompt.
  if (conversationHistory.length >= 6) {
    contents.push(systemAside(buildRoleReinforcement(aiRole)));
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  try {
    const rawText = await callGemini(systemPrompt, contents, { json: true, temperature: 0.7 });
    const parsed = JSON.parse(rawText || '{}');
    let replyText = parsed.reply || '';

    const drifted = await detectRoleDrift(replyText, scenario, conversationHistory.length);
    if (drifted) {
      const correctiveContents: GeminiContent[] = [
        ...contents,
        systemAside(
          `Your previous attempt broke the role boundary by speaking for the user. This attempt must contain only ${aiRole}'s single utterance — never the user's line, never a speaker label, never narration for the user.`
        ),
      ];
      const retryRawText = await callGemini(systemPrompt, correctiveContents, { json: true, temperature: 0.7 });
      const retryParsed = JSON.parse(retryRawText || '{}');
      // Use the retried reply unconditionally — no third attempt, no recursion.
      replyText = retryParsed.reply || replyText;
    }

    // Handle background translation execution seamlessly. Translate only
    // the final chosen reply, never a discarded drifted draft.
    const translation = await translateToEnglish(replyText, activeLang);

    return {
      reply: replyText,
      translation: translation,
    };
  } catch (error) {
    console.error('Error generating partner response:', error);
    return {
      reply: activeLang.toLowerCase() === 'hausa' ? 'Gafara gani, wani abu ya faru da kuskure.' : 'E binu, nkankan ko tọ lẹnu igbiyanju mi.',
      translation: 'Apologies, something went wrong with my response generation.',
    };
  }
}

/**
 * Generates dynamic hints/suggestions for the user to help them respond.
 */
export async function getReplySuggestions(
  scenario: any,
  proficiencyLevel: ProficiencyLevel,
  conversationHistory: Message[],
  lastAiMessage: string,
  language?: string
): Promise<{ suggestions: ReplySuggestion[] }> {
  const activeLang = language || scenario?.language || 'yoruba';
  const systemPrompt = buildReplySuggestionsSystemPrompt(proficiencyLevel, lastAiMessage, activeLang);

  const suggestionPrompt = `Based on the conversation above, generate 3 alternative options for how the user could respond next to your last message: "${lastAiMessage}"`;

  const contents: GeminiContent[] = [
    ...formatGeminiHistory(conversationHistory),
    { role: 'user', parts: [{ text: suggestionPrompt }] },
  ];

  try {
    const rawText = await callGemini(systemPrompt, contents, { json: true, temperature: 0.6 });
    return JSON.parse(rawText || '{"suggestions":[]}');
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return { suggestions: [] };
  }
}

/**
 * Evaluates the conversation based on the user's proficiency level and scenario.
 */
export async function evaluateConversation(
  scenario: any,
  conversationHistory: Message[],
  language?: string
): Promise<Evaluation> {
  const activeLang = language || scenario?.language || 'yoruba';
  const systemPrompt = buildEvaluationSystemPrompt(activeLang);

  const contents: GeminiContent[] = [
    ...formatGeminiHistory(conversationHistory),
    { role: 'user', parts: [{ text: 'Please evaluate the conversation above.' }] },
  ];

  try {
    const rawText = await callGemini(systemPrompt, contents, { json: true, temperature: 0.3 });
    return JSON.parse(rawText || '{}');
  } catch (error) {
    console.error('Error evaluating conversation:', error);
    throw error;
  }
}

/**
 * Assesses whether the user's current proficiency level still fits their performance,
 * recommending a level adjustment when the conversation suggests otherwise.
 */
export async function assessProficiency(
  conversationHistory: Message[],
  proficiencyLevel: ProficiencyLevel,
  language?: string
): Promise<ProficiencyAssessment> {
  const systemPrompt = buildProficiencyAssessmentSystemPrompt(proficiencyLevel, language);

  const contents: GeminiContent[] = [
    ...formatGeminiHistory(conversationHistory),
    { role: 'user', parts: [{ text: 'Please assess my proficiency level based on the conversation above.' }] },
  ];

  try {
    const rawText = await callGemini(systemPrompt, contents, { json: true, temperature: 0.3 });
    return JSON.parse(rawText || `{"recommendedLevel":"${proficiencyLevel}","rationale":"","confidence":"low"}`);
  } catch (error) {
    console.error('Error assessing proficiency:', error);
    return { recommendedLevel: proficiencyLevel, rationale: '', confidence: 'low' };
  }
}

/**
 * Utility translation engine internal module.
 */
async function translateToEnglish(text: string, sourceLanguage: string): Promise<string> {
  if (!text) return '';

  const systemPrompt = buildTranslationSystemPrompt(sourceLanguage);

  try {
    const rawText = await callGemini(
      systemPrompt,
      [{ role: 'user', parts: [{ text }] }],
      { json: false, temperature: 0.3 }
    );
    return rawText.trim();
  } catch {
    return '';
  }
}
