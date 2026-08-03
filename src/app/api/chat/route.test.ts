import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';

const { classifyUserTurnMock, getAsideAnswerMock, getPartnerResponseMock, getScenarioByIdMock } = vi.hoisted(() => ({
  classifyUserTurnMock: vi.fn(),
  getAsideAnswerMock: vi.fn(),
  getPartnerResponseMock: vi.fn(),
  getScenarioByIdMock: vi.fn(),
}));

vi.mock('@/services/llm', () => ({
  classifyUserTurn: classifyUserTurnMock,
  getAsideAnswer: getAsideAnswerMock,
  getPartnerResponse: getPartnerResponseMock,
}));

vi.mock('@/config/scenarios', () => ({
  getScenarioById: getScenarioByIdMock,
}));

import { POST } from './route';

const originalFetch = global.fetch;

function makeRequest(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

const baseScenario = {
  id: 'market-haggling',
  language: 'yoruba',
  aiRole: 'Mama Nkechi, a warm but shrewd Yoruba market woman',
};

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    scenarioId: 'market-haggling',
    proficiencyLevel: 'beginner',
    conversationHistory: [],
    userMessage: 'Elo ni eleyi?',
    ...overrides,
  };
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    classifyUserTurnMock.mockReset();
    getAsideAnswerMock.mockReset();
    getPartnerResponseMock.mockReset();
    getScenarioByIdMock.mockReset();
    getScenarioByIdMock.mockReturnValue(baseScenario);
    global.fetch = vi.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns 200 with a discriminated roleplay body and calls getPartnerResponse, not getAsideAnswer', async () => {
    classifyUserTurnMock.mockResolvedValueOnce('roleplay');
    getPartnerResponseMock.mockResolvedValueOnce({ reply: 'O ni owo meji.', translation: 'It costs two hundred.' });

    const request = makeRequest(baseBody());
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ kind: 'roleplay', reply: 'O ni owo meji.', translation: 'It costs two hundred.' });
    expect(getPartnerResponseMock).toHaveBeenCalledTimes(1);
    expect(getAsideAnswerMock).not.toHaveBeenCalled();
  });

  it('returns 200 with a discriminated aside body and calls getAsideAnswer, not getPartnerResponse', async () => {
    classifyUserTurnMock.mockResolvedValueOnce('aside');
    getAsideAnswerMock.mockResolvedValueOnce({ answer: "Tomati means 'tomato' in Yoruba." });

    const request = makeRequest(baseBody({ userMessage: 'how do I say tomato?' }));
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ kind: 'aside', answer: "Tomati means 'tomato' in Yoruba." });
    expect(getAsideAnswerMock).toHaveBeenCalledTimes(1);
    expect(getPartnerResponseMock).not.toHaveBeenCalled();
  });

  it('forceAside: true routes to getAsideAnswer without calling classifyUserTurn', async () => {
    getAsideAnswerMock.mockResolvedValueOnce({ answer: 'Plain English explanation.' });

    const request = makeRequest(baseBody({ userMessage: 'and the plural?', forceAside: true }));
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ kind: 'aside', answer: 'Plain English explanation.' });
    expect(classifyUserTurnMock).not.toHaveBeenCalled();
    expect(getAsideAnswerMock).toHaveBeenCalledTimes(1);
  });

  it('strips aside-tagged conversationHistory entries before reaching getPartnerResponse', async () => {
    classifyUserTurnMock.mockResolvedValueOnce('roleplay');
    getPartnerResponseMock.mockResolvedValueOnce({ reply: 'reply', translation: 'translation' });

    const history = [
      { id: '1', role: 'ai', content: 'starter', timestamp: 1, kind: 'roleplay' },
      { id: '2', role: 'user', content: 'roleplay turn', timestamp: 2, kind: 'roleplay' },
      { id: '3', role: 'user', content: 'how do I say X?', timestamp: 3, kind: 'aside-question' },
      { id: '4', role: 'ai', content: 'X means Y', timestamp: 4, kind: 'aside-answer' },
    ];

    const request = makeRequest(baseBody({ conversationHistory: history }));
    await POST(request);

    const receivedHistory = getPartnerResponseMock.mock.calls[0][2];
    expect(receivedHistory.map((m: any) => m.id)).toEqual(['1', '2']);
  });

  it('returns 404 for an unknown scenarioId', async () => {
    getScenarioByIdMock.mockReturnValueOnce(undefined);

    const request = makeRequest(baseBody({ scenarioId: 'nonexistent' }));
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Scenario not found');
  });

  it('returns 400 with the existing Zod error message format for an invalid body', async () => {
    const request = makeRequest({ scenarioId: 'market-haggling' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(typeof data.error).toBe('string');
    expect(data.error.length).toBeGreaterThan(0);
  });
});
