import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/services/gemini', () => ({
  reviewPartnerReply: vi.fn(async () => ({
    translation: 'translated', addressesLatestTurn: true,
    staysInScene: true, inTargetLanguage: true, reason: '',
  })),
  getPartnerResponse: vi.fn(async () => ({ reply: 'gemini reply', translation: 'gemini translation' })),
}));

import { getPartnerResponse, buildAyaSystemPrompt } from '@/services/aya';
import { getScenarioById } from '@/config/scenarios';

const originalFetch = global.fetch;
const scenario = getScenarioById('hausa-restaurant')!;

function mockCohereReplies(...texts: string[]) {
  for (const text of texts) {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ message: { role: 'assistant', content: [{ type: 'text', text }] } }),
    });
  }
}

describe('buildAyaSystemPrompt', () => {
  it('includes the scene and tells the model who "you" refers to', () => {
    const p = buildAyaSystemPrompt(scenario, 'beginner', 'hausa');
    expect(p).toContain(`You are ${scenario.aiRole}, in a roleplay for a Hausa language learner.`);
    expect(p).toContain(`Scene: ${scenario.description}.`);
    expect(p).toContain('"you" means the learner');
    expect(p).toContain("Answer the learner's latest meaning");
    expect(p).toContain('Reply only in Hausa, in one short sentence');
  });
});

describe('getPartnerResponse (Tiny Aya)', () => {
  beforeEach(() => {
    global.fetch = vi.fn() as any;
    process.env.COHERE_API_KEY = 'test-key';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.COHERE_API_KEY;
    vi.restoreAllMocks();
  });

  it('calls the Cohere Chat API with tiny-aya-earth and returns a checked reply', async () => {
    // Real Tiny Aya output: multi-sentence and self-labelled; trimmed to one sentence.
    mockCohereReplies('Mama Rabi: Muna da tuwo shinkafa da miyan kuka. Yau muna da abin da zai yi daɗi!');
    const res = await getPartnerResponse(scenario, 'beginner', [], 'Na gode. Me kuke da shi yau?', 'hausa');
    expect(res).toEqual({ reply: 'Muna da tuwo shinkafa da miyan kuka.', translation: 'translated' });

    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('https://api.cohere.com/v2/chat');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: 'tiny-aya-earth', temperature: 0.7, max_tokens: 64 });
    expect(body.messages[0]).toEqual({ role: 'system', content: buildAyaSystemPrompt(scenario, 'beginner', 'hausa') });
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Na gode. Me kuke da shi yau?' });
  });

  it('falls back to Gemini when the API key is missing', async () => {
    delete process.env.COHERE_API_KEY;
    const res = await getPartnerResponse(scenario, 'beginner', [], 'Sannu', 'hausa');
    expect(res.reply).toBe('gemini reply');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to Gemini after three rejected replies', async () => {
    mockCohereReplies('Na gode. Me kuke da shi yau?', '<...>', '');
    const res = await getPartnerResponse(scenario, 'beginner', [], 'Na gode. Me kuke da shi yau?', 'hausa');
    expect(res.reply).toBe('gemini reply');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
