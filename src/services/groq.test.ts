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

import { evaluateConversation, classifyUserTurn, getAsideAnswer } from '@/services/groq';

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
});
