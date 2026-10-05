import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { evaluateConversationMock, getScenarioByIdMock } = vi.hoisted(() => ({
  evaluateConversationMock: vi.fn(),
  getScenarioByIdMock: vi.fn(),
}));

vi.mock('@/services/llm', () => ({ evaluateConversation: evaluateConversationMock }));
vi.mock('@/config/scenarios', () => ({ getScenarioById: getScenarioByIdMock }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

import { POST } from './route';

const messages = [
  { id: '1', role: 'user', content: 'Sannu', timestamp: 1 },
  { id: '2', role: 'ai', content: 'Lafiya', timestamp: 2 },
  { id: '3', role: 'user', content: 'Na gode', timestamp: 3 },
];

function request(body: unknown) {
  return { json: async () => body } as unknown as NextRequest;
}

describe('POST /api/evaluate', () => {
  beforeEach(() => {
    evaluateConversationMock.mockReset();
    getScenarioByIdMock.mockReset();
    getScenarioByIdMock.mockReturnValue({ id: 'hausa-market-haggling', language: 'hausa' });
  });

  it('uses the scenario language even if the client claims another language', async () => {
    evaluateConversationMock.mockResolvedValueOnce({ overallScore: 7 });
    const response = await POST(request({
      scenarioId: 'hausa-market-haggling',
      proficiencyLevel: 'beginner',
      language: 'yoruba',
      messages,
    }));

    expect(response.status).toBe(200);
    expect(evaluateConversationMock).toHaveBeenCalledWith(
      { id: 'hausa-market-haggling', language: 'hausa' }, messages, 'hausa', 'beginner'
    );
  });

  it('does not score a conversation with fewer than two learner turns', async () => {
    const response = await POST(request({
      scenarioId: 'hausa-market-haggling',
      proficiencyLevel: 'beginner',
      messages: messages.slice(0, 2),
    }));

    expect(response.status).toBe(400);
    expect(evaluateConversationMock).not.toHaveBeenCalled();
  });
});
