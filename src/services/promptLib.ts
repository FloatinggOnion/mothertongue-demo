import { ProficiencyLevel } from '@/types';

/**
 * Shared, provider-agnostic prompt text and heuristics used by every LLM
 * backend (Groq, Gemini, ...). Keeping this logic in one place guarantees
 * every provider sees byte-identical prompts, so swapping the backend never
 * silently changes model behavior.
 */

/** Resolves a display-cased language name from a free-form language string. */
export function langDisplayName(language?: string): 'Hausa' | 'Yoruba' {
  return (language || '').toLowerCase() === 'hausa' ? 'Hausa' : 'Yoruba';
}

/**
 * Builds the immersive roleplay system instructions for the AI partner.
 * Injects the exact language target (Yoruba or Hausa) dynamically.
 */
export function buildPartnerSystemPrompt(
  scenario: any,
  proficiencyLevel: ProficiencyLevel,
  language?: string
): string {
  // Read from the explicit argument first, fallback to the attached property, default to yoruba
  const activeLang = language || scenario?.language || 'yoruba';
  const langDisplay = langDisplayName(activeLang);

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

  const aiRole = scenario?.aiRole || 'Conversation Partner';

  return `
    You are an immersive, interactive language-learning AI partner roleplaying a specific persona.

    CRITICAL CONTEXT:
    - Target Language to Speak: ${langDisplay}
    - User Proficiency Level: ${proficiencyLevel.toUpperCase()}
    - Your Assigned Character Role: ${aiRole}
    - Scenario Setting/Context: ${scenario?.description || 'General Conversation'}
    - Starter Prompt Context: "${scenario?.starterPrompt || ''}"

    ROLE BOUNDARY (ABSOLUTE):
    - You are ONLY ${aiRole}. The human user is the *other* party in this scene; you are never that person.
    - Produce exactly ONE utterance, spoken by ${aiRole}, and then stop.
    - Never write the user's lines, never prefix any speaker label or name-colon to your output, never write narration, stage directions, or actions for the user, never invent or predict what the user said or will say, never continue the exchange past your own turn.
    - If the user's meaning is unclear, ask one short in-character clarifying question rather than supplying their line for them.

    ROLEPLAY BEHAVIOR RULES:
    1. Stay 100% in character as "${aiRole}". Never break character to say "As an AI..." or "Welcome to this lesson...".
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
 * One-line, recency-biased reminder of the role boundary. Inserted right
 * before the newest user turn on longer conversations, since a system
 * line adjacent to the latest turn survives long histories better than
 * the far-away opening prompt.
 */
export function buildRoleReinforcement(aiRole: string): string {
  return `Reminder: you are ONLY ${aiRole}. Never speak, narrate, or write dialogue for the user — produce exactly one utterance for ${aiRole} and then stop.`;
}

/** Escapes regex special characters for safe interpolation into a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Heuristic (free) speaker-label / stage-direction detector for role drift.
 * Matches: a line-start speaker label for the user side, a line-start label
 * using the AI character's own name (self-labeling is also a boundary
 * break), bracketed/asterisked stage directions addressing the user, and
 * 2+ line-start speaker labels anywhere in the reply.
 */
const DRIFT_USER_LABEL_PATTERN = /^\s*(user|you|me|customer|buyer|student|learner)\s*:/im;
const DRIFT_STAGE_DIRECTION_PATTERNS: RegExp[] = [
  /\*[^*]*\b(you|the user|the customer)\b[^*]*\*/i,
  /\[[^\]]*\byou\b[^\]]*\]/i,
];
const DRIFT_LINE_LABEL_PATTERN = /^\s*[A-Za-z][\w' -]{0,30}:/gm;

/** Below this history length, a role-drift check isn't worth an extra LLM call. */
export const DRIFT_LLM_CHECK_THRESHOLD = 6;

export function hasHeuristicRoleDrift(reply: string, scenario: any): boolean {
  if (DRIFT_USER_LABEL_PATTERN.test(reply)) return true;

  const aiRoleFirstWord = String(scenario?.aiRole || '').trim().split(/\s+/)[0];
  if (aiRoleFirstWord) {
    const ownLabelPattern = new RegExp(`^\\s*${escapeRegExp(aiRoleFirstWord)}\\s*:`, 'im');
    if (ownLabelPattern.test(reply)) return true;
  }

  if (DRIFT_STAGE_DIRECTION_PATTERNS.some((pattern) => pattern.test(reply))) return true;

  const lineLabelMatches = reply.match(DRIFT_LINE_LABEL_PATTERN) || [];
  if (lineLabelMatches.length >= 2) return true;

  return false;
}

/** System prompt for the (rare) LLM-backed role-drift audit call. */
export function buildDriftCheckSystemPrompt(aiRole: string): string {
  return `
    You are auditing a single line of roleplay dialogue for a language-learning app.
    The speaker is supposed to be ONLY "${aiRole}".
    Determine whether the following reply is actually voicing the user's/other party's side
    of the conversation rather than speaking purely as "${aiRole}".

    OUTPUT FORMAT REQUIREMENTS:
    Return strictly one JSON object: { "voicedUser": true } or { "voicedUser": false }.
    Do not output anything outside the JSON structure.
  `.trim();
}

/**
 * Cheap heuristic patterns that short-circuit classification of a user turn
 * as an out-of-character aside, avoiding a network call entirely.
 */
export const ASIDE_PATTERNS: RegExp[] = [
  /how (do|would) (i|you) say\b/i,
  /what does\b[^?]*\bmean\b/i,
  /what'?s the word for\b/i,
  /how do you pronounce\b/i,
  /\btranslate\b/i,
  /\bin english\b/i,
  /^\s*(wait|hold on|sorry),\s*.*\?\s*$/i,
];

/** System prompt for the aside-vs-roleplay turn classifier. */
export function buildClassifyTurnSystemPrompt(language?: string): string {
  const langDisplay = langDisplayName(language);
  return `
    The user is mid-roleplay in a ${langDisplay} language-learning drill.
    Decide whether their turn is an in-character line spoken to their
    conversation partner, or an out-of-character meta question to the app
    about the language itself (e.g. asking how to say/pronounce/translate
    something, or asking what a word means).

    OUTPUT FORMAT REQUIREMENTS:
    Return strictly one JSON object: { "kind": "aside" } or { "kind": "roleplay" }.
    Do not output anything outside the JSON structure.
  `.trim();
}

/** System prompt answering a learner's out-of-character side question. */
export function buildAsideAnswerSystemPrompt(
  proficiencyLevel: ProficiencyLevel,
  language?: string
): string {
  const langDisplay = langDisplayName(language);
  return `
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
}

/** System prompt generating dynamic reply-suggestion hints for the user. */
export function buildReplySuggestionsSystemPrompt(
  proficiencyLevel: ProficiencyLevel,
  lastAiMessage: string,
  language?: string
): string {
  const langDisplay = langDisplayName(language);
  return `
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
}

/** System prompt evaluating a completed conversation. */
export function buildEvaluationSystemPrompt(language?: string): string {
  const langDisplay = langDisplayName(language);
  return `
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
}

/** System prompt assessing whether the user's proficiency level still fits. */
export function buildProficiencyAssessmentSystemPrompt(
  proficiencyLevel: ProficiencyLevel,
  language?: string
): string {
  const langDisplay = langDisplayName(language);
  return `
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
}

/** System prompt for the internal translation utility. */
export function buildTranslationSystemPrompt(sourceLanguage: string): string {
  return `You are a professional linguist. Translate the provided text from ${sourceLanguage} cleanly into natural English text. Return only the flat string translation.`;
}
