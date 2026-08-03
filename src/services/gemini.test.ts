import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { generateContentMock, GoogleGenAIMock } = vi.hoisted(() => {
  const generateContentMock = vi.fn();
  // Must be a real `function`, not an arrow function — gemini.ts calls
  // `new GoogleGenAI(...)`, and arrow functions can't be used as constructors.
  const GoogleGenAIMock = vi.fn().mockImplementation(function () {
    return { models: { generateContent: generateContentMock } };
  });
  return { generateContentMock, GoogleGenAIMock };
});

vi.mock('@google/genai', () => ({
  GoogleGenAI: GoogleGenAIMock,
}));

// Mock the logger to avoid file system side effects in tests
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

import {
  evaluateConversation,
  classifyUserTurn,
  getAsideAnswer,
  detectRoleDrift,
  getPartnerResponse,
} from '@/services/gemini';

function mockGenerateOnce(text: string) {
  generateContentMock.mockResolvedValueOnce({ text });
}

/** Counts generateContent calls whose systemInstruction is the partner-reply prompt. */
function countGenerationCalls(): number {
  return generateContentMock.mock.calls.filter((call: any[]) => {
    const config = call[0]?.config ?? {};
    return typeof config.systemInstruction === 'string' && config.systemInstruction.includes('immersive');
  }).length;
}

describe('Gemini Service', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    GoogleGenAIMock.mockClear();
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
    process.env.GOOGLE_CLIENT_EMAIL = 'test@test-project.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = 'test-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('evaluateConversation()', () => {
    it('returns the parsed evaluation on a successful response', async () => {
      const evaluation = {
        strength: 'Good vocabulary',
        strengthExample: 'Bawo ni',
        improvement: 'Work on tone',
        correctedSentence: 'Bawo ni o se wa',
        overallScore: 7,
        fluencyScore: 60,
        grammarScore: 65,
        confidenceScore: 70,
      };

      mockGenerateOnce(JSON.stringify(evaluation));

      const scenario = { id: 'test', language: 'yoruba' } as any;
      const messages: any[] = [{ id: '1', role: 'user', content: 'Bawo ni', timestamp: 1 }];

      await expect(evaluateConversation(scenario, messages)).resolves.toEqual(evaluation);
    });

    it('throws on JSON parse failure instead of returning a fallback', async () => {
      mockGenerateOnce('{invalid json}');

      const scenario = { id: 'test', language: 'yoruba' } as any;
      await expect(evaluateConversation(scenario, [])).rejects.toBeDefined();
    });

    it('propagates an error when the Gemini API request fails', async () => {
      generateContentMock.mockRejectedValueOnce(new Error('bad request'));

      const scenario = { id: 'test', language: 'yoruba' } as any;
      await expect(evaluateConversation(scenario, [])).rejects.toThrow('Gemini API Error');
    });
  });

  describe('classifyUserTurn()', () => {
    it("resolves to 'aside' with zero generateContent calls for a heuristic match", async () => {
      const result = await classifyUserTurn('how do I say tomato?');

      expect(result).toBe('aside');
      expect(generateContentMock).not.toHaveBeenCalled();
    });

    it("issues one Gemini call and resolves 'aside' when the model returns aside for a non-matching message", async () => {
      mockGenerateOnce(JSON.stringify({ kind: 'aside' }));

      const result = await classifyUserTurn('Ile mi da?');

      expect(result).toBe('aside');
      expect(generateContentMock).toHaveBeenCalledTimes(1);
    });

    it("resolves 'roleplay' when the model returns roleplay", async () => {
      mockGenerateOnce(JSON.stringify({ kind: 'roleplay' }));

      const result = await classifyUserTurn('Elo ni eleyi?');

      expect(result).toBe('roleplay');
    });

    it('resolves roleplay (fail-safe) when the Gemini call rejects', async () => {
      generateContentMock.mockRejectedValueOnce(new Error('network down'));

      const result = await classifyUserTurn('Elo ni eleyi?');

      expect(result).toBe('roleplay');
    });

    it('resolves roleplay (fail-safe) when the Gemini call returns unparsable JSON', async () => {
      mockGenerateOnce('{not json}');

      const result = await classifyUserTurn('Elo ni eleyi?');

      expect(result).toBe('roleplay');
    });
  });

  describe('getAsideAnswer()', () => {
    it('returns the parsed answer string on a successful response', async () => {
      mockGenerateOnce(JSON.stringify({ answer: 'Tomati means tomato.' }));

      const scenario = { id: 'test', language: 'yoruba' } as any;
      const result = await getAsideAnswer('how do I say tomato?', scenario, 'beginner');

      expect(result).toEqual({ answer: 'Tomati means tomato.' });
    });

    it('returns a non-empty fallback string instead of throwing when the call fails', async () => {
      generateContentMock.mockRejectedValueOnce(new Error('network down'));

      const scenario = { id: 'test', language: 'yoruba' } as any;
      const result = await getAsideAnswer('how do I say tomato?', scenario, 'beginner');

      expect(typeof result.answer).toBe('string');
      expect(result.answer.length).toBeGreaterThan(0);
    });
  });

  describe('detectRoleDrift()', () => {
    it('flags a reply containing a speaker label for the user side, heuristic only, zero calls', async () => {
      const scenario = { aiRole: 'Mama Nkechi' } as any;

      const result = await detectRoleDrift('You: How much is it?', scenario, 0);

      expect(result).toBe(true);
      expect(generateContentMock).not.toHaveBeenCalled();
    });

    it('returns false without any Gemini call when historyLength is below the LLM-check threshold', async () => {
      const scenario = { aiRole: 'Mama Nkechi' } as any;

      const result = await detectRoleDrift('E ku aaro, se daadaa ni?', scenario, 2);

      expect(result).toBe(false);
      expect(generateContentMock).not.toHaveBeenCalled();
    });

    it('issues one Gemini call for a heuristically-clean reply at/above the threshold, and returns true when the model flags it', async () => {
      mockGenerateOnce(JSON.stringify({ voicedUser: true }));
      const scenario = { aiRole: 'Mama Nkechi' } as any;

      const result = await detectRoleDrift('E ku aaro, se daadaa ni?', scenario, 6);

      expect(result).toBe(true);
      expect(generateContentMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPartnerResponse() — role-drift retry', () => {
    it('systemInstruction names the scenario aiRole and forbids voicing the user\'s dialogue', async () => {
      mockGenerateOnce(JSON.stringify({ reply: 'Bawo ni, se o fe ra nkankan?' }));
      mockGenerateOnce('Hello, would you like to buy something?');

      const scenario = { aiRole: 'Mama Nkechi', language: 'yoruba' } as any;
      await getPartnerResponse(scenario, 'beginner', [], 'Bawo ni');

      const firstCallConfig = generateContentMock.mock.calls[0][0].config;

      expect(firstCallConfig.systemInstruction).toContain('Mama Nkechi');
      expect(firstCallConfig.systemInstruction.toLowerCase()).toContain("never write the user's lines");
    });

    it('regenerates exactly once when the first reply drifts: returns the second reply, total generation calls = 2', async () => {
      mockGenerateOnce(JSON.stringify({ reply: 'You: How much is it?' })); // gen 1 — drifted (heuristic)
      mockGenerateOnce(JSON.stringify({ reply: 'O ni owo meji lonu.' })); // gen 2 — clean retry
      mockGenerateOnce('It costs two hundred.'); // translation

      const scenario = { aiRole: 'Mama Nkechi', language: 'yoruba' } as any;
      const result = await getPartnerResponse(scenario, 'beginner', [], 'Elo ni?');

      expect(result.reply).toBe('O ni owo meji lonu.');
      expect(countGenerationCalls()).toBe(2);
    });

    it('returns the second reply even if it also drifts (no third attempt)', async () => {
      mockGenerateOnce(JSON.stringify({ reply: 'You: How much is it?' })); // gen 1 — drifted
      mockGenerateOnce(JSON.stringify({ reply: 'You: Still drifted.' })); // gen 2 — also drifted, used unconditionally
      mockGenerateOnce('Still drifted translation.'); // translation

      const scenario = { aiRole: 'Mama Nkechi', language: 'yoruba' } as any;
      const result = await getPartnerResponse(scenario, 'beginner', [], 'Elo ni?');

      expect(result.reply).toBe('You: Still drifted.');
      expect(countGenerationCalls()).toBe(2);
    });

    it('makes only one generation call when the first reply is clean', async () => {
      mockGenerateOnce(JSON.stringify({ reply: 'O daabo, se o fe ra nkankan?' })); // gen 1 — clean
      mockGenerateOnce('Welcome, would you like to buy something?'); // translation

      const scenario = { aiRole: 'Mama Nkechi', language: 'yoruba' } as any;
      const result = await getPartnerResponse(scenario, 'beginner', [], 'Bawo ni');

      expect(result.reply).toBe('O daabo, se o fe ra nkankan?');
      expect(countGenerationCalls()).toBe(1);
    });
  });
});
