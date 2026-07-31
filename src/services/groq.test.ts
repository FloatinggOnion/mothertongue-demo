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

      mockFetchOnce({ choices: [{ message: { content: JSON.stringify(evaluation) } }] });

      const scenario = { id: 'test', language: 'yoruba' } as any;
      const messages: any[] = [{ role: 'user', content: 'Bawo ni' }];

      await expect(evaluateConversation(scenario, messages)).resolves.toEqual(evaluation);
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
