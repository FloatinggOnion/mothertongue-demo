import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { getReplySuggestionsMock } = vi.hoisted(() => ({ getReplySuggestionsMock: vi.fn() }));
vi.mock('@/services/llm', () => ({ getReplySuggestions: getReplySuggestionsMock }));

import { POST } from './route';

function request(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

const validBody = {
  scenarioId: 'market-haggling',
  proficiencyLevel: 'beginner',
  conversationHistory: [],
  lastAiMessage: 'Kí ló fẹ́ ra?',
  language: 'yoruba',
};

describe('POST /api/suggestions', () => {
  beforeEach(() => getReplySuggestionsMock.mockReset());

  it('returns a usable hint list', async () => {
    getReplySuggestionsMock.mockResolvedValueOnce({ suggestions: [
      { text: 'Èló ni?', translation: 'How much?', label: 'Ask the price' },
    ] });
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suggestions: [
      { text: 'Èló ni?', translation: 'How much?', label: 'Ask the price' },
    ] });
  });

  it('uses the configured scenario language when the client omits it', async () => {
    getReplySuggestionsMock.mockResolvedValueOnce({ suggestions: [
      { text: 'Sannu', translation: 'Hello' },
    ] });
    await POST(request({ ...validBody, scenarioId: 'hausa-market-haggling', language: undefined }));
    expect(getReplySuggestionsMock.mock.calls[0][0].language).toBe('hausa');
  });

  it('rejects an empty or malformed model response instead of silently succeeding', async () => {
    getReplySuggestionsMock.mockResolvedValueOnce({ suggestions: [] });
    const response = await POST(request(validBody));
    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain('Guidance is unavailable');
  });

  it('returns a server error when the provider fails', async () => {
    getReplySuggestionsMock.mockRejectedValueOnce(new Error('provider unavailable'));
    const response = await POST(request(validBody));
    expect(response.status).toBe(500);
  });

  it('rejects invalid input before calling the provider', async () => {
    const response = await POST(request({ ...validBody, lastAiMessage: '' }));
    expect(response.status).toBe(400);
    expect(getReplySuggestionsMock).not.toHaveBeenCalled();
  });
});
