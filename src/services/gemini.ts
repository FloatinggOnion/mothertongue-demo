import { Message, ProficiencyLevel, ReplySuggestion, Evaluation, ProficiencyAssessment } from '@/types';

// Helper to get API configurations cleanly
const getApiKey = () => process.env.GEMINI_API_KEY || '';
const getBaseUrl = () => 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Helper to format application message history into the strict alternating sequence 
 * required by the Gemini REST API. Ensures the first message is 'user' and merges 
 * consecutive identical roles.
 */
function formatGeminiHistory(history: Message[]): any[] {
  const contents: any[] = [];
  
  for (const msg of history) {
    const role = msg.role === 'ai' ? 'model' : 'user';
    
    // Rule 1: First message must be 'user'
    if (contents.length === 0 && role === 'model') {
      contents.push({ role: 'user', parts: [{ text: 'Let us begin.' }] });
    }
    
    // Rule 2: Strictly alternating roles
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += '\n\n' + msg.content;
    } else {
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }
  
  return contents;
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
 * Generates the AI partner's conversational response and seamlessly translates it to English.
 */
export async function getPartnerResponse(
  scenario: any,
  proficiencyLevel: ProficiencyLevel,
  conversationHistory: Message[],
  userMessage: string,
  language?: string
) {
  const apiKey = getApiKey();
  const activeLang = language || scenario?.language || 'yoruba';
  const systemPrompt = buildPartnerSystemPrompt(scenario, proficiencyLevel, activeLang);

  // Map application message roles to Gemini content structure
  const formattedContents = formatGeminiHistory(conversationHistory);

  // Append latest turn
  if (formattedContents.length > 0 && formattedContents[formattedContents.length - 1].role === 'user') {
    formattedContents[formattedContents.length - 1].parts[0].text += '\n\n' + userMessage;
  } else {
    formattedContents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });
  }

  try {
    const response = await fetch(`${getBaseUrl()}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: formattedContents,
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`);

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(rawText);
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
  const apiKey = getApiKey();
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

  const formattedContents = formatGeminiHistory(conversationHistory);

  const suggestionPrompt = `Based on the conversation above, generate 3 alternative options for how the user could respond next to your last message: "${lastAiMessage}"`;

  if (formattedContents.length > 0 && formattedContents[formattedContents.length - 1].role === 'user') {
    formattedContents[formattedContents.length - 1].parts[0].text += '\n\n' + suggestionPrompt;
  } else {
    formattedContents.push({ role: 'user', parts: [{ text: suggestionPrompt }] });
  }

  try {
    const response = await fetch(`${getBaseUrl()}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: formattedContents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini Suggestions API Error:', response.status, errorText);
      throw new Error(`Failed to fetch suggestions from Gemini: ${response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{"suggestions":[]}';
    return JSON.parse(rawText);
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
  const apiKey = getApiKey();
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

  const formattedContents = formatGeminiHistory(conversationHistory);
  
  // Enforce rule: evaluate requests shouldn't end on 'model' if we can help it, 
  // but if we are just evaluating the history, it's safer to ensure we append the evaluation ask as a user.
  if (formattedContents.length === 0 || formattedContents[formattedContents.length - 1].role === 'model') {
    formattedContents.push({ role: 'user', parts: [{ text: 'Please evaluate the conversation above.' }] });
  } else {
    formattedContents[formattedContents.length - 1].parts[0].text += '\n\nPlease evaluate the conversation above.';
  }

  try {
    const response = await fetch(`${getBaseUrl()}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: formattedContents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    });

    if (!response.ok) throw new Error('Failed to evaluate conversation');

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return JSON.parse(rawText);
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
  const apiKey = getApiKey();
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

  const formattedContents = formatGeminiHistory(conversationHistory);

  if (formattedContents.length === 0 || formattedContents[formattedContents.length - 1].role === 'model') {
    formattedContents.push({ role: 'user', parts: [{ text: 'Please assess my proficiency level based on the conversation above.' }] });
  } else {
    formattedContents[formattedContents.length - 1].parts[0].text += '\n\nPlease assess my proficiency level based on the conversation above.';
  }

  try {
    const response = await fetch(`${getBaseUrl()}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: formattedContents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    });

    if (!response.ok) throw new Error('Failed to assess proficiency');

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
      || `{"recommendedLevel":"${proficiencyLevel}","rationale":"","confidence":"low"}`;
    return JSON.parse(rawText);
  } catch (error) {
    console.error('Error assessing proficiency:', error);
    return { recommendedLevel: proficiencyLevel, rationale: '', confidence: 'low' };
  }
}

/**
 * Utility translation engine internal module.
 */
async function translateToEnglish(text: string, sourceLanguage: string): Promise<string> {
  const apiKey = getApiKey();
  if (!text) return '';

  const systemPrompt = `You are a professional linguist. Translate the provided text from ${sourceLanguage} cleanly into natural English text. Return only the flat string translation.`;

  try {
    const response = await fetch(`${getBaseUrl()}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
      }),
    });

    if (!response.ok) return '';
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  } catch {
    return '';
  }
}