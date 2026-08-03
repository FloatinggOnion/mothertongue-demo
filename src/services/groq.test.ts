import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalFetch = global.fetch;

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  (global.fetch as any).mockResolvedValueOnce({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

// Mock the logger to avoid file system side effects in tests
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

import { evaluateConversation, classifyUserTurn, getAsideAnswer, detectRoleDrift, getPartnerResponse } from '@/services/groq';

/** Counts fetch calls whose request body is a partner-reply generation call. */
function countGenerationCalls(): number {
  return (global.fetch as any).mock.calls.filter((call: any[]) => {
    const body = JSON.parse(call[1]?.body ?? '{}');
    const systemContent = body.messages?.[0]?.content ?? '';
    return typeof systemContent === 'string' && systemContent.includes('immersive');
  }).length;
}

describe('Groq Service', () => {
  beforeEach(() => {
    global.fetch = vi.fn() as any;
    process.env.GROQ_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('evaluateConversation()', () => {
    it('returns a correctly shaped evaluation with overallScore derived from sub-scores', async () => {
      // The model response deliberately includes a wrong overallScore (99) to prove
      // the function ignores it and computes the value in code instead.
      const modelResponse = {
        strength: 'Good vocabulary',
        strengthExample: 'Bawo ni',
        improvement: 'Work on tone',
        correctedSentence: 'Bawo ni o se wa',
        fluencyReasoning: 'User produced a short correct opener.',
        fluencyScore: 60,
        grammarReasoning: 'Basic grammar was mostly correct.',
        grammarScore: 65,
        confidenceReasoning: 'User responded without hesitation.',
        confidenceScore: 70,
        overallScore: 99, // intentionally wrong — should be ignored
      };

      mockFetchOnce({ choices: [{ message: { content: JSON.stringify(modelResponse) } }] });

      const scenario = { id: 'test', language: 'yoruba' } as any;
      const messages: any[] = [{ role: 'user', content: 'Bawo ni' }];

      const result = await evaluateConversation(scenario, messages, undefined, 'beginner');

      // overallScore must be derived: Math.round((60 + 65 + 70) / 30) = Math.round(6.5) = 7
      expect(result.overallScore).toBe(Math.round((60 + 65 + 70) / 30));
      expect(result.fluencyScore).toBe(60);
      expect(result.grammarScore).toBe(65);
      expect(result.confidenceScore).toBe(70);
      expect(result.strength).toBe('Good vocabulary');
    });

    it('includes the correct proficiencyLevel rubric text in the outgoing system prompt', async () => {
      const modelResponse = {
        strength: 'S', strengthExample: 'E', improvement: 'I', correctedSentence: 'C',
        fluencyReasoning: 'R', fluencyScore: 50,
        grammarReasoning: 'R', grammarScore: 50,
        confidenceReasoning: 'R', confidenceScore: 50,
      };

      // beginner call
      mockFetchOnce({ choices: [{ message: { content: JSON.stringify(modelResponse) } }] });
      const scenario = { id: 'test', language: 'yoruba' } as any;
      await evaluateConversation(scenario, [], undefined, 'beginner');

      const beginnerBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      const beginnerSystem: string = beginnerBody.messages[0].content;
      expect(beginnerSystem).toContain('BEGINNER');
      expect(beginnerSystem).toContain('"beginner" level');

      vi.clearAllMocks();
      global.fetch = vi.fn() as any;

      // advanced call
      mockFetchOnce({ choices: [{ message: { content: JSON.stringify(modelResponse) } }] });
      await evaluateConversation(scenario, [], undefined, 'advanced');

      const advancedBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      const advancedSystem: string = advancedBody.messages[0].content;
      expect(advancedSystem).toContain('ADVANCED');
      expect(advancedSystem).toContain('"advanced" level');
      // Beginner rubric must NOT appear when level is advanced
      expect(advancedSystem).not.toContain('BEGINNER');
    });

    it('overallScore equals Math.round((fluency+grammar+confidence)/30) for multiple sub-score combos', async () => {
      const combos = [
        { f: 80, g: 80, c: 80 }, // 240/30 = 8
        { f: 100, g: 100, c: 100 }, // 300/30 = 10
        { f: 30, g: 20, c: 10 }, // 60/30 = 2
        { f: 55, g: 60, c: 65 }, // 180/30 = 6
      ];

      for (const { f, g, c } of combos) {
        global.fetch = vi.fn() as any;
        const modelResponse = {
          strength: 'S', strengthExample: 'E', improvement: 'I', correctedSentence: 'C',
          fluencyReasoning: 'R', fluencyScore: f,
          grammarReasoning: 'R', grammarScore: g,
          confidenceReasoning: 'R', confidenceScore: c,
          overallScore: 1, // intentionally wrong — should be ignored
        };
        mockFetchOnce({ choices: [{ message: { content: JSON.stringify(modelResponse) } }] });

        const scenario = { id: 'test', language: 'yoruba' } as any;
        const result = await evaluateConversation(scenario, [], undefined, 'intermediate');

        expect(result.overallScore).toBe(Math.round((f + g + c) / 30));
      }
    });

    it('throws on JSON parse failure instead of returning a fallback', async () => {
      mockFetchOnce({ choices: [{ message: { content: '{invalid json}' } }] });

      const scenario = { id: 'test', language: 'yoruba' } as any;
      const messages: any[] = [];

      await expect(evaluateConversation(scenario, messages)).rejects.toBeDefined();
    });

    it('propagates an error when the Groq API request fails', async () => {
      mockFetchOnce({ error: 'bad request' }, false, 400);

      const scenario = { id: 'test', language: 'yoruba' } as any;
      const messages: any[] = [];

      await expect(evaluateConversation(scenario, messages)).rejects.toThrow('Groq API Error');
    });
  });

  describe('classifyUserTurn()', () => {
    it("resolves to 'aside' with zero fetch calls for a heuristic match", async () => {
      const result = await classifyUserTurn('how do I say tomato?');

      expect(result).toBe('aside');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("issues one Groq call and resolves 'aside' when the model returns aside for a non-matching message", async () => {
      mockFetchOnce({ choices: [{ message: { content: JSON.stringify({ kind: 'aside' }) } }] });

      const result = await classifyUserTurn('Ile mi da?');

      expect(result).toBe('aside');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("resolves 'roleplay' when the model returns roleplay", async () => {
      mockFetchOnce({ choices: [{ message: { content: JSON.stringify({ kind: 'roleplay' }) } }] });

      const result = await classifyUserTurn('Elo ni eleyi?');

      expect(result).toBe('roleplay');
    });

    it('resolves roleplay (fail-safe) when the Groq call rejects', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('network down'));

      const result = await classifyUserTurn('Elo ni eleyi?');

      expect(result).toBe('roleplay');
    });

    it('resolves roleplay (fail-safe) when the Groq call returns unparsable JSON', async () => {
      mockFetchOnce({ choices: [{ message: { content: '{not json}' } }] });

      const result = await classifyUserTurn('Elo ni eleyi?');

      expect(result).toBe('roleplay');
    });
  });

  describe('getAsideAnswer()', () => {
    it('returns the parsed answer string on a successful response', async () => {
      mockFetchOnce({ choices: [{ message: { content: JSON.stringify({ answer: 'Tomati means tomato.' }) } }] });

      const scenario = { id: 'test', language: 'yoruba' } as any;
      const result = await getAsideAnswer('how do I say tomato?', scenario, 'beginner');

      expect(result).toEqual({ answer: 'Tomati means tomato.' });
    });

    it('returns a non-empty fallback string instead of throwing when the call fails', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('network down'));

      const scenario = { id: 'test', language: 'yoruba' } as any;
      const result = await getAsideAnswer('how do I say tomato?', scenario, 'beginner');

      expect(typeof result.answer).toBe('string');
      expect(result.answer.length).toBeGreaterThan(0);
    });
  });

  describe('detectRoleDrift()', () => {
    it('flags a reply containing a speaker label for the user side, heuristic only, zero fetch calls', async () => {
      const scenario = { aiRole: 'Mama Nkechi' } as any;

      const result = await detectRoleDrift('You: How much is it?', scenario, 0);

      expect(result).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('flags a reply containing two distinct speaker-labelled lines, heuristic only', async () => {
      const scenario = { aiRole: 'Mama Nkechi' } as any;
      const reply = 'Fatima: Welcome!\nIbrahim: Thanks for having me.';

      const result = await detectRoleDrift(reply, scenario, 0);

      expect(result).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns false without any Groq call for a clean reply when historyLength is below the LLM-check threshold', async () => {
      const scenario = { aiRole: 'Mama Nkechi' } as any;

      const result = await detectRoleDrift('E ku aaro, se daadaa ni?', scenario, 2);

      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('issues one Groq call for a heuristically-clean reply at/above the threshold, and returns false when that call rejects', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('network down'));
      const scenario = { aiRole: 'Mama Nkechi' } as any;

      const result = await detectRoleDrift('E ku aaro, se daadaa ni?', scenario, 6);

      expect(result).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('issues one Groq call for a heuristically-clean reply at/above the threshold, and returns true when the model flags it', async () => {
      mockFetchOnce({ choices: [{ message: { content: JSON.stringify({ voicedUser: true }) } }] });
      const scenario = { aiRole: 'Mama Nkechi' } as any;

      const result = await detectRoleDrift('E ku aaro, se daadaa ni?', scenario, 6);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPartnerResponse() — role-drift retry', () => {
    it("buildPartnerSystemPrompt output names the scenario aiRole and forbids voicing the user's dialogue", async () => {
      mockFetchOnce({ choices: [{ message: { content: JSON.stringify({ reply: 'Bawo ni, se o fe ra nkankan?' }) } }] });
      mockFetchOnce({ choices: [{ message: { content: 'Hello, would you like to buy something?' } }] });

      const scenario = { aiRole: 'Mama Nkechi', language: 'yoruba' } as any;
      await getPartnerResponse(scenario, 'beginner', [], 'Bawo ni');

      const firstCallBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      const systemContent: string = firstCallBody.messages[0].content;

      expect(systemContent).toContain('Mama Nkechi');
      expect(systemContent.toLowerCase()).toContain("never write the user's lines");
    });

    it('regenerates exactly once when the first reply drifts: returns the second reply, total generation calls = 2', async () => {
      mockFetchOnce({ choices: [{ message: { content: JSON.stringify({ reply: 'You: How much is it?' } ) } }] }); // gen 1 — drifted (heuristic)
      mockFetchOnce({ choices: [{ message: { content: JSON.stringify({ reply: 'O ni owo meji lonu.' } ) } }] }); // gen 2 — clean retry
      mockFetchOnce({ choices: [{ message: { content: 'It costs two hundred.' } }] }); // translation

      const scenario = { aiRole: 'Mama Nkechi', language: 'yoruba' } as any;
      const result = await getPartnerResponse(scenario, 'beginner', [], 'Elo ni?');

      expect(result.reply).toBe('O ni owo meji lonu.');
      expect(countGenerationCalls()).toBe(2);
    });

    it('returns the second reply even if it also drifts (no third attempt)', async () => {
      mockFetchOnce({ choices: [{ message: { content: JSON.stringify({ reply: 'You: How much is it?' } ) } }] }); // gen 1 — drifted
      mockFetchOnce({ choices: [{ message: { content: JSON.stringify({ reply: 'You: Still drifted.' } ) } }] }); // gen 2 — also drifted, used unconditionally
      mockFetchOnce({ choices: [{ message: { content: 'Still drifted translation.' } }] }); // translation

      const scenario = { aiRole: 'Mama Nkechi', language: 'yoruba' } as any;
      const result = await getPartnerResponse(scenario, 'beginner', [], 'Elo ni?');

      expect(result.reply).toBe('You: Still drifted.');
      expect(countGenerationCalls()).toBe(2);
    });

    it('makes only one generation call when the first reply is clean', async () => {
      mockFetchOnce({ choices: [{ message: { content: JSON.stringify({ reply: 'O daabo, se o fe ra nkankan?' } ) } }] }); // gen 1 — clean
      mockFetchOnce({ choices: [{ message: { content: 'Welcome, would you like to buy something?' } }] }); // translation

      const scenario = { aiRole: 'Mama Nkechi', language: 'yoruba' } as any;
      const result = await getPartnerResponse(scenario, 'beginner', [], 'Bawo ni');

      expect(result.reply).toBe('O daabo, se o fe ra nkankan?');
      expect(countGenerationCalls()).toBe(1);
    });
  });
});
