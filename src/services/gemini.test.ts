import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted() runs before vi.mock() factories, ensuring the fn is available
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

// Mock GoogleGenAI using the hoisted mock fn
vi.mock('@google/genai', () => ({
  GoogleGenAI: function MockGoogleGenAI(this: any) {
    this.models = { generateContent: mockGenerateContent };
  },
}));

// Mock the logger to avoid file system side effects in tests
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

// Import service after mocks are set up
import { callGemini, evaluateConversation } from '@/services/gemini';

describe('Gemini Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Use fake timers to avoid actual backoff delays in tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('callGemini() — exponential backoff retry logic', () => {
    it('INFRA-02: should retry exactly 3 times on 429 error with exponential backoff', async () => {
      // Mock: throw 429 twice, then succeed on 3rd attempt
      mockGenerateContent
        .mockRejectedValueOnce({ status: 429 })
        .mockRejectedValueOnce({ status: 429 })
        .mockResolvedValueOnce({ text: 'success' });

      // Run the callGemini promise and advance timers to skip backoff delays
      const promise = callGemini({
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      });

      // Advance through all backoff windows
      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('success');
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    it('INFRA-02: should NOT retry on 400 error', async () => {
      // Non-retryable: throws immediately without any delay
      mockGenerateContent.mockRejectedValueOnce({ status: 400 });

      await expect(
        callGemini({ contents: [{ role: 'user', parts: [{ text: 'test' }] }] })
      ).rejects.toMatchObject({ status: 400 });

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('INFRA-02: should NOT retry on 403 error', async () => {
      // Non-retryable: throws immediately without any delay
      mockGenerateContent.mockRejectedValueOnce({ status: 403 });

      await expect(
        callGemini({ contents: [{ role: 'user', parts: [{ text: 'test' }] }] })
      ).rejects.toMatchObject({ status: 403 });

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('INFRA-02: should retry on 503 and 502 errors', async () => {
      mockGenerateContent
        .mockRejectedValueOnce({ status: 503 })
        .mockRejectedValueOnce({ status: 502 })
        .mockResolvedValueOnce({ text: 'success' });

      const promise = callGemini({
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
      });

      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('success');
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });
  });

  describe('evaluateConversation() — error propagation', () => {
    it('INFRA-01: should throw on JSON parse failure instead of returning fallback', async () => {
      // Mock callGemini to return invalid JSON string (no retry delays — immediate resolve)
      mockGenerateContent.mockResolvedValueOnce({ text: '{invalid json}' });

      const scenario = { id: 'test', context: 'test' } as any;
      const messages: any[] = [];

      // Should throw JSON.parse error, not return fallback
      await expect(evaluateConversation(scenario, messages)).rejects.toBeDefined();
    });

    it('INFRA-01: should throw on Gemini API error', async () => {
      // Non-retryable error (no status property) — throws immediately without delay
      mockGenerateContent.mockRejectedValueOnce(new Error('API error'));

      const scenario = { id: 'test', context: 'test' } as any;
      const messages: any[] = [];

      // Should propagate error, not catch and return fallback
      await expect(evaluateConversation(scenario, messages)).rejects.toThrow('API error');
    });
  });
});
