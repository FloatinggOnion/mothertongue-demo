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

import { evaluateConversation } from '@/services/groq';

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
});
