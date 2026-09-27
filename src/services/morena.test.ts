import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  process.env.MORENA_MODAL_URL = 'https://morena.test/infer';
});

vi.mock('@/services/gemini', () => ({
  translateToEnglish: vi.fn(async () => 'translated'),
  getPartnerResponse: vi.fn(async () => ({ reply: 'gemini reply', translation: 'gemini translation' })),
}));

import { checkMorenaReply, getPartnerResponse, buildMorenaSystemPrompt } from '@/services/morena';
import { getScenarioById } from '@/config/scenarios';

const originalFetch = global.fetch;
const scenario = getScenarioById('market-haggling')!;
const starter = scenario.starterPrompt;
const opts = { level: 'beginner' as const, userMessage: 'Ẹ ṣé. Kí lẹ ní lónìí?', scenario };

function mockModalReplies(...texts: string[]) {
  for (const text of texts) {
    (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ text }) });
  }
}

describe('buildMorenaSystemPrompt', () => {
  it('is a single short instruction with no JSON example', () => {
    const p = buildMorenaSystemPrompt(scenario, 'beginner', 'yoruba');
    expect(p).toBe(`You are ${scenario.aiRole}. Reply to the user in Yoruba, in one short sentence.`);
    expect(p).not.toMatch(/json|reply"/i);
  });
});

// Raw strings below are real outputs captured from the deployed Morena endpoint.
describe('checkMorenaReply', () => {
  it('keeps only the first line when the model runs on', () => {
    const raw = 'Mo ní tòmátì tuntun, ó sì dára gan-an!\n\n<|assistant|>Ẹ ṣé.\n```python\nimport aiohttp';
    expect(checkMorenaReply(raw, opts)).toEqual({ reply: 'Mo ní tòmátì tuntun, ó sì dára gan-an!', reason: 'ok' });
  });

  it('truncates to the sentence limit for the level', () => {
    const raw = 'Muna da tummeric. Kuma barkono yana nan. Me kake so?';
    expect(checkMorenaReply(raw, { ...opts, userMessage: 'x' }).reply).toBe('Muna da tummeric.');
    expect(checkMorenaReply(raw, { ...opts, userMessage: 'x', level: 'intermediate' }).reply)
      .toBe('Muna da tummeric. Kuma barkono yana nan.');
  });

  it.each([
    ['', 'empty'],
    ['Ẹ ṣé <[...]>', 'markup'],
    ['{"reply": "Ẹ ṣé"}', 'markup'],
    ['Onye ahịa: Tomato dị ₦1,500 maka otu.', 'speaker-label'],
    ['Ìtumọ̀ náà ni translation', 'meta'],
    ['Sannu, lafiya lau. Sannu, lafiya lau.', 'repetition'],
    ['Pleased to meet you! How are you? I get the best tummeric and pepper today.', 'english'],
    ['Ẹ ṣé. Kí lẹ ní lónìí?', 'echo-user'],
  ])('rejects %j as %s', (raw, reason) => {
    expect(checkMorenaReply(raw, opts)).toEqual({ reply: null, reason });
  });

  it('allows restating its own earlier line (e.g. repeating the menu when asked)', () => {
    expect(checkMorenaReply('Ẹ wá ra nǹkan tuntun?', opts).reason).toBe('ok');
  });

  it('rejects over-long replies', () => {
    expect(checkMorenaReply('Mo ní ' + 'tòmátì '.repeat(30) + '.', opts).reason).toBe('too-long');
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

  it('falls back to Gemini when the Modal endpoint errors', async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    const res = await getPartnerResponse(scenario, 'beginner', [], 'Ẹ ṣé.', 'yoruba');
    expect(res.reply).toBe('gemini reply');
  });
});
