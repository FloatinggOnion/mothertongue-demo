import { describe, it, expect, vi, beforeEach } from 'vitest';

const impls = vi.hoisted(() => ({
  morena: vi.fn(async () => ({ reply: 'morena', translation: '' })),
  aya: vi.fn(async () => ({ reply: 'aya', translation: '' })),
  gemini: vi.fn(async () => ({ reply: 'gemini', translation: '' })),
}));

vi.mock('@/services/morena', () => ({ getPartnerResponse: impls.morena }));
vi.mock('@/services/aya', () => ({ getPartnerResponse: impls.aya }));
const otherExports = {
  getReplySuggestions: vi.fn(), evaluateConversation: vi.fn(), assessProficiency: vi.fn(),
  classifyUserTurn: vi.fn(), getAsideAnswer: vi.fn(), detectRoleDrift: vi.fn(),
};
vi.mock('@/services/gemini', () => ({ getPartnerResponse: impls.gemini, ...otherExports }));
vi.mock('@/services/groq', () => ({ getPartnerResponse: vi.fn(), ...otherExports }));

async function loadWithProvider(provider: string) {
  vi.resetModules();
  process.env.LLM_PROVIDER = provider;
  return import('@/services/llm');
}

describe('LLM_PROVIDER=hybrid', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['yoruba', 'gemini'],
    ['hausa', 'aya'],
    ['igbo', 'aya'],
    ['swahili', 'gemini'],
  ])('routes %s partner replies to %s', async (language, expected) => {
    const llm = await loadWithProvider('hybrid');
    const res = await llm.getPartnerResponse({ language }, 'beginner', [], 'hi');
    expect(res.reply).toBe(expected);
  });

  it('prefers the explicit language argument over the scenario language', async () => {
    const llm = await loadWithProvider('hybrid');
    expect((await llm.getPartnerResponse({ language: 'yoruba' }, 'beginner', [], 'hi', 'hausa')).reply).toBe('aya');
    expect((await llm.getPartnerResponse({ language: 'hausa' }, 'beginner', [], 'hi', 'yoruba')).reply).toBe('gemini');
  });

  it('still lets LLM_PROVIDER=morena and =aya select a single model', async () => {
    expect((await (await loadWithProvider('morena')).getPartnerResponse({ language: 'hausa' }, 'beginner', [], 'hi')).reply).toBe('morena');
    expect((await (await loadWithProvider('aya')).getPartnerResponse({ language: 'yoruba' }, 'beginner', [], 'hi')).reply).toBe('aya');
  });
});
