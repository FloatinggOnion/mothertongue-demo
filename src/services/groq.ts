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

// Helper to get API configurations cleanly
const getApiKey = () => process.env.GROQ_API_KEY || '';
const getBaseUrl = () => 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

/**
 * Helper to format application message history into the OpenAI-compatible
 * chat message shape expected by the Groq API.
 */
function formatGroqHistory(history: Message[]): { role: 'user' | 'assistant'; content: string }[] {
  return history.map((msg) => ({
    role: msg.role === 'ai' ? 'assistant' : 'user',
    content: msg.content,
  }));
}

/**
 * Sends a chat completion request to Groq and returns the raw message content string.
 */
async function callGroq(
  messages: { role: string; content: string }[],
  options: { json?: boolean; temperature?: number } = {}
): Promise<string> {
  const apiKey = getApiKey();
  const { json = false, temperature = 0.7 } = options;

  const response = await fetch(getBaseUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API Error: ${response.status} ${response.statusText} ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Detects whether a generated partner reply has drifted into voicing the
 * user's side of the conversation. Stage 1 is a free heuristic that always
 * runs. Stage 2 (a single cheap Groq call) only fires when the heuristic is
 * clean AND the conversation is long enough that drift risk justifies the
 * cost. Any failure in the LLM check resolves to false — never block a
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
    const rawText = await callGroq(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: reply },
      ],
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
 * cheap Groq call when the heuristic doesn't match. Fail-safe direction:
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
    const rawText = await callGroq(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
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
    const rawText = await callGroq(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuestion },
      ],
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

  const historyMessages = formatGroqHistory(conversationHistory);
  const messages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
  ];

  // Periodic reinforcement: on longer histories, insert a recency-biased
  // reminder immediately before the newest user turn — it survives long
  // histories better than the far-away opening system prompt.
  if (conversationHistory.length >= 6) {
    messages.push({ role: 'system', content: buildRoleReinforcement(aiRole) });
  }
  messages.push({ role: 'user', content: userMessage });

  try {
    const rawText = await callGroq(messages, { json: true, temperature: 0.7 });
    const parsed = JSON.parse(rawText || '{}');
    let replyText = parsed.reply || '';

    const drifted = await detectRoleDrift(replyText, scenario, conversationHistory.length);
    if (drifted) {
      const correctiveMessages: { role: string; content: string }[] = [
        ...messages,
        {
          role: 'system',
          content: `Your previous attempt broke the role boundary by speaking for the user. This attempt must contain only ${aiRole}'s single utterance — never the user's line, never a speaker label, never narration for the user.`,
        },
      ];
      const retryRawText = await callGroq(correctiveMessages, { json: true, temperature: 0.7 });
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

  const messages = [
    { role: 'system', content: systemPrompt },
    ...formatGroqHistory(conversationHistory),
    { role: 'user', content: suggestionPrompt },
  ];

  try {
    const rawText = await callGroq(messages, { json: true, temperature: 0.6 });
    return JSON.parse(rawText || '{"suggestions":[]}');
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return { suggestions: [] };
  }
}

/**
 * Evaluates the conversation based on the user's proficiency level and scenario.
 *
 * Key improvements over the old version:
 *  - `proficiencyLevel` is threaded in so the rubric is level-matched.
 *  - Per-level anchors (80-100 / 50-79 / 1-49) give the model a concrete bar.
 *  - Reasoning fields force the model to justify each score before committing.
 *  - STT context tells the model not to penalise transcription noise as grammar.
 *  - `temperature: 0` removes run-to-run variance for a deterministic task.
 *  - `overallScore` is derived in code (average of three sub-scores / 30) so it
 *    can never contradict the sub-scores.
 */
export async function evaluateConversation(
  scenario: any,
  conversationHistory: Message[],
  language?: string,
  proficiencyLevel: ProficiencyLevel = 'beginner'
): Promise<Evaluation> {
  const activeLang = language || scenario?.language || 'yoruba';
  const systemPrompt = buildEvaluationSystemPrompt(activeLang, proficiencyLevel);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...formatGroqHistory(conversationHistory),
    { role: 'user', content: 'Please evaluate the conversation above.' },
  ];

  try {
    const rawText = await callGroq(messages, { json: true, temperature: 0 });
    const parsed = JSON.parse(rawText || '{}');

    const fluencyScore = Number(parsed.fluencyScore) || 0;
    const grammarScore = Number(parsed.grammarScore) || 0;
    const confidenceScore = Number(parsed.confidenceScore) || 0;

    return {
      strength: parsed.strength || '',
      strengthExample: parsed.strengthExample,
      improvement: parsed.improvement || '',
      correctedSentence: parsed.correctedSentence || '',
      fluencyScore,
      grammarScore,
      confidenceScore,
      // Derived in code, not model-guessed — keeps it mathematically consistent with the sub-scores.
      overallScore: Math.round((fluencyScore + grammarScore + confidenceScore) / 30),
    };
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

  const messages = [
    { role: 'system', content: systemPrompt },
    ...formatGroqHistory(conversationHistory),
    { role: 'user', content: 'Please assess my proficiency level based on the conversation above.' },
  ];

  try {
    const rawText = await callGroq(messages, { json: true, temperature: 0.3 });
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
    const rawText = await callGroq(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      { json: false, temperature: 0.3 }
    );
    return rawText.trim();
  } catch {
    return '';
  }
}
