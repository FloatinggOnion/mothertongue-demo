import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  process.env.MORENA_MODAL_URL = 'https://morena.test/infer';
});

vi.mock('@/services/gemini', () => ({
  reviewPartnerReply: vi.fn(async () => ({
    translation: 'translated', addressesLatestTurn: true,
    staysInScene: true, inTargetLanguage: true, reason: '',
  })),
  getPartnerResponse: vi.fn(async () => ({ reply: 'gemini reply', translation: 'gemini translation' })),
}));

import { getPartnerResponse, buildMorenaSystemPrompt } from '@/services/morena';
import { reviewPartnerReply } from '@/services/gemini';
import { getScenarioById } from '@/config/scenarios';

const originalFetch = global.fetch;
const scenario = getScenarioById('market-haggling')!;
const starter = scenario.starterPrompt;

function mockModalReplies(...texts: string[]) {
  for (const text of texts) {
    (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ text }) });
  }
}

describe('buildMorenaSystemPrompt', () => {
  it('is a single short instruction with no JSON example', () => {
    const p = buildMorenaSystemPrompt(scenario, 'beginner', 'yoruba');
    expect(p).toBe(`You are ${scenario.aiRole}. Answer the user's latest meaning in Yoruba, in one short sentence. Stay in the scene.`);
    expect(p).not.toMatch(/json|reply"/i);
  });
});

describe('getPartnerResponse (Morena)', () => {
  beforeEach(() => {
    global.fetch = vi.fn() as any;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('resamples until a reply passes the checks', async () => {
    mockModalReplies('Ẹ ṣé. Kí lẹ ní lónìí?', 'Ẹ ṣé <[...]>', 'Mo ní tòmátì tuntun.');
    const res = await getPartnerResponse(scenario, 'beginner', [], 'Ẹ ṣé. Kí lẹ ní lónìí?', 'yoruba');
    expect(res).toEqual({ reply: 'Mo ní tòmátì tuntun.', translation: 'translated' });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('sends the short prompt, full history and a level-sized token budget', async () => {
    mockModalReplies('Mo ní tòmátì tuntun.');
    const history = [{ id: '1', role: 'ai' as const, content: starter, timestamp: 0 }];
    await getPartnerResponse(scenario, 'beginner', history, 'Ẹ ṣé.', 'yoruba');
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.system_prompt).toBe(buildMorenaSystemPrompt(scenario, 'beginner', 'yoruba'));
    expect(body.messages).toEqual([
      { role: 'assistant', content: starter },
      { role: 'user', content: 'Ẹ ṣé.' },
    ]);
    expect(body.max_new_tokens).toBe(64);
  });

  it('falls back to Gemini after three rejected replies', async () => {
    mockModalReplies('<...>', '<...>', '<...>');
    const res = await getPartnerResponse(scenario, 'beginner', [], 'Ẹ ṣé.', 'yoruba');
    expect(res).toEqual({ reply: 'gemini reply', translation: 'gemini translation' });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('resamples a fluent reply that misses the learner request', async () => {
    vi.mocked(reviewPartnerReply)
      .mockResolvedValueOnce({
        translation: 'Good morning.', addressesLatestTurn: false,
        staysInScene: true, inTargetLanguage: true, reason: 'Missed the tomato request.',
      })
      .mockResolvedValueOnce({
        translation: 'How many tomatoes would you like?', addressesLatestTurn: true,
        staysInScene: true, inTargetLanguage: true, reason: '',
      });
    mockModalReplies('Ẹ kú àárọ̀.', 'Ẹ fẹ́ tòmátì mélòó?');

    const result = await getPartnerResponse(scenario, 'beginner', [], 'I want tomatoes, please.', 'yoruba');

    expect(result).toEqual({ reply: 'Ẹ fẹ́ tòmátì mélòó?', translation: 'How many tomatoes would you like?' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back to Gemini when the Modal endpoint errors', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    const res = await getPartnerResponse(scenario, 'beginner', [], 'Ẹ ṣé.', 'yoruba');
    expect(res.reply).toBe('gemini reply');
  });
});
