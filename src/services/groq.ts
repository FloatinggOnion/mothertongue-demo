import { Message, ProficiencyLevel, ReplySuggestion, Evaluation, ProficiencyAssessment } from '@/types';

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
 * Builds the immersive roleplay system instructions for the AI partner.
 * Injects the exact language target (Yoruba or Hausa) dynamically.
 */
function buildPartnerSystemPrompt(
  scenario: any,
  proficiencyLevel: ProficiencyLevel,
  language?: string
): string {
  // Read from the explicit argument first, fallback to the attached property, default to yoruba
  const activeLang = language || scenario?.language || 'yoruba';
  const langDisplay = activeLang.toLowerCase() === 'hausa' ? 'Hausa' : 'Yoruba';

  let structuralInstruction = '';
  switch (proficiencyLevel) {
    case 'beginner':
      structuralInstruction = `
        - Keep your utterances extremely short, simple, and clear (1 short sentence max).
        - Use very basic vocabulary and standard expressions.
        - If the user uses English, gently guide them back to ${langDisplay} naturally.
      `;
      break;
    case 'intermediate':
      structuralInstruction = `
        - Use full sentences with a mix of everyday vocabulary and idiomatic phrases.
        - You can speak at a normal conversational pace (2 sentences max per turn).
        - Introduce common cultural idioms or modern slang naturally where appropriate.
      `;
      break;
    case 'advanced':
      structuralInstruction = `
        - Engage in deep, fast-paced, complex conversation using rich, authentic, and culturally dense vocabulary.
        - Feel free to express abstract thoughts, complex emotions, or nuanced opinions.
        - Do not simplify your grammar. Respond like a passionate native speaker would in real life.
      `;
      break;
  }

  return `
    You are an immersive, interactive language-learning AI partner roleplaying a specific persona.

    CRITICAL CONTEXT:
    - Target Language to Speak: ${langDisplay}
    - User Proficiency Level: ${proficiencyLevel.toUpperCase()}
    - Your Assigned Character Role: ${scenario?.aiRole || 'Conversation Partner'}
    - Scenario Setting/Context: ${scenario?.description || 'General Conversation'}
    - Starter Prompt Context: "${scenario?.starterPrompt || ''}"

    ROLEPLAY BEHAVIOR RULES:
    1. Stay 100% in character as "${scenario?.aiRole || 'Conversation Partner'}". Never break character to say "As an AI..." or "Welcome to this lesson...".
    2. Do not offer explicit grammar corrections or structured feedback in the middle of the chat flow. Act exactly like a real person would in this scenario.
    3. Keep your response relevant to the conversational thread.

    LEVEL-SPECIFIC CONSTAINTS:
    ${structuralInstruction}

    OUTPUT FORMAT REQUIREMENTS:
    Return your response strictly as a JSON object with a single "reply" string key. Do not output anything outside the JSON structure.
    Example: { "reply": "Pleased to meet you!" }
  `.trim();
}

/**
 * Cheap heuristic patterns that short-circuit classification of a user turn
 * as an out-of-character aside, avoiding a network call entirely.
 */
const ASIDE_PATTERNS: RegExp[] = [
  /how (do|would) (i|you) say\b/i,
  /what does\b[^?]*\bmean\b/i,
  /what'?s the word for\b/i,
  /how do you pronounce\b/i,
  /\btranslate\b/i,
  /\bin english\b/i,
  /^\s*(wait|hold on|sorry),\s*.*\?\s*$/i,
];

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

  const langDisplay = (language || 'yoruba').toLowerCase() === 'hausa' ? 'Hausa' : 'Yoruba';

  const systemPrompt = `
    The user is mid-roleplay in a ${langDisplay} language-learning drill.
    Decide whether their turn is an in-character line spoken to their
    conversation partner, or an out-of-character meta question to the app
    about the language itself (e.g. asking how to say/pronounce/translate
    something, or asking what a word means).

    OUTPUT FORMAT REQUIREMENTS:
    Return strictly one JSON object: { "kind": "aside" } or { "kind": "roleplay" }.
    Do not output anything outside the JSON structure.
  `.trim();

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
  const langDisplay = activeLang.toLowerCase() === 'hausa' ? 'Hausa' : 'Yoruba';

  const systemPrompt = `
    You are a helpful ${langDisplay} tutor answering a quick side question
    from a learner. You are OUT OF CHARACTER — never roleplay, never
    continue the scene, never greet in persona.

    Answer in plain English in at most 3 sentences. When the learner asked
    how to say something, include the ${langDisplay} phrase plus a short
    literal gloss. Tailor your register to a "${proficiencyLevel}" level
    learner.

    OUTPUT FORMAT REQUIREMENTS:
    Return strictly one JSON object with a single "answer" string key.
    Example: { "answer": "..." }
  `.trim();

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
  const systemPrompt = buildPartnerSystemPrompt(scenario, proficiencyLevel, activeLang);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...formatGroqHistory(conversationHistory),
    { role: 'user', content: userMessage },
  ];

  try {
    const rawText = await callGroq(messages, { json: true, temperature: 0.7 });
    const parsed = JSON.parse(rawText || '{}');
    const replyText = parsed.reply || '';

    // Handle background translation execution seamlessly
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
  const langDisplay = activeLang.toLowerCase() === 'hausa' ? 'Hausa' : 'Yoruba';

  const systemPrompt = `
    You are an expert ${langDisplay} language learning coach.
    Analyze the last message sent by the AI companion: "${lastAiMessage}"

    Generate exactly 3 alternative options for how the user could respond next.
    Tailor these options precisely to a user at the "${proficiencyLevel}" level.

    OUTPUT FORMAT REQUIREMENTS:
    Return a JSON object containing a "suggestions" array. Each item must have:
    - "text": The response variant written completely in ${langDisplay}.
    - "translation": The English meaning.
    - "label": A brief situational hint describing the intent/tone (e.g., "Polite Agreement", "Inquire further", "Express Surprise").

    Example Schema:
    {
      "suggestions": [
        { "text": "Bẹẹ ni, mo fẹ́.", "translation": "Yes, I want to.", "label": "Accept Invitation" }
      ]
    }
  `.trim();

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
 */
export async function evaluateConversation(
  scenario: any,
  conversationHistory: Message[],
  language?: string
): Promise<Evaluation> {
  const activeLang = language || scenario?.language || 'yoruba';
  const langDisplay = activeLang.toLowerCase() === 'hausa' ? 'Hausa' : 'Yoruba';

  const systemPrompt = `
    You are an expert ${langDisplay} language evaluator.
    Review the following conversation between a user learning ${langDisplay} and an AI.
    Provide a constructive evaluation of the user's performance.

    OUTPUT FORMAT REQUIREMENTS:
    Return exactly one JSON object with the following schema:
    {
      "strength": "string (One thing they did well)",
      "strengthExample": "string (A quote from the user demonstrating this strength)",
      "improvement": "string (One area to improve)",
      "correctedSentence": "string (A corrected version of one of their sentences)",
      "overallScore": number (1-10),
      "fluencyScore": number (1-100),
      "grammarScore": number (1-100),
      "confidenceScore": number (1-100)
    }
  `.trim();

  const messages = [
    { role: 'system', content: systemPrompt },
    ...formatGroqHistory(conversationHistory),
    { role: 'user', content: 'Please evaluate the conversation above.' },
  ];

  try {
    const rawText = await callGroq(messages, { json: true, temperature: 0.3 });
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
  const langDisplay = (language || '').toLowerCase() === 'hausa' ? 'Hausa' : 'Yoruba';

  const systemPrompt = `
    You are an expert ${langDisplay} language proficiency assessor.
    The user is currently set at the "${proficiencyLevel}" level.
    Review the following conversation and judge whether this level still fits the user's
    demonstrated ability, or whether a different level would serve them better.

    OUTPUT FORMAT REQUIREMENTS:
    Return exactly one JSON object with the following schema:
    {
      "recommendedLevel": "beginner" | "intermediate" | "advanced",
      "rationale": "string (a brief, encouraging explanation for the recommendation)",
      "confidence": "low" | "high"
    }

    Only set "confidence" to "high" when the conversation gives clear, consistent evidence
    that a different level would suit the user better. Otherwise use "low".
  `.trim();

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

  const systemPrompt = `You are a professional linguist. Translate the provided text from ${sourceLanguage} cleanly into natural English text. Return only the flat string translation.`;

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
