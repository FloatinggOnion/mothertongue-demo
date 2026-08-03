import { describe, it, expect, afterEach, vi } from 'vitest';

vi.mock('./groq', () => ({
  getPartnerResponse: vi.fn(),
  getReplySuggestions: vi.fn(),
  evaluateConversation: vi.fn(),
  assessProficiency: vi.fn(),
  classifyUserTurn: vi.fn(),
  getAsideAnswer: vi.fn(),
  detectRoleDrift: vi.fn(),
}));

vi.mock('./gemini', () => ({
  getPartnerResponse: vi.fn(),
  getReplySuggestions: vi.fn(),
  evaluateConversation: vi.fn(),
  assessProficiency: vi.fn(),
  classifyUserTurn: vi.fn(),
  getAsideAnswer: vi.fn(),
  detectRoleDrift: vi.fn(),
}));

const originalProvider = process.env.LLM_PROVIDER;

describe('LLM provider router', () => {
  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.LLM_PROVIDER;
    } else {
      process.env.LLM_PROVIDER = originalProvider;
    }
    vi.resetModules();
  });

  it('defaults to Gemini when LLM_PROVIDER is unset', async () => {
    delete process.env.LLM_PROVIDER;
    vi.resetModules();

    const router = await import('./llm');
    const gemini = await import('./gemini');

    expect(router.getPartnerResponse).toBe(gemini.getPartnerResponse);
    expect(router.evaluateConversation).toBe(gemini.evaluateConversation);
  });

  it('routes to Groq when LLM_PROVIDER=groq', async () => {
    process.env.LLM_PROVIDER = 'groq';
    vi.resetModules();

    const router = await import('./llm');
    const groq = await import('./groq');

    expect(router.getPartnerResponse).toBe(groq.getPartnerResponse);
    expect(router.classifyUserTurn).toBe(groq.classifyUserTurn);
  });

  it('routes to Gemini when LLM_PROVIDER=GEMINI (case-insensitive)', async () => {
    process.env.LLM_PROVIDER = 'GEMINI';
    vi.resetModules();

    const router = await import('./llm');
    const gemini = await import('./gemini');

    expect(router.getAsideAnswer).toBe(gemini.getAsideAnswer);
  });
});
