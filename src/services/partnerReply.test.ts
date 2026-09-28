import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/gemini', () => ({
  translateToEnglish: vi.fn(),
  getPartnerResponse: vi.fn(),
}));

import { checkPartnerReply } from '@/services/partnerReply';
import { getScenarioById } from '@/config/scenarios';

const scenario = getScenarioById('market-haggling')!;
const opts = { level: 'beginner' as const, userMessage: 'Ẹ ṣé. Kí lẹ ní lónìí?', scenario };

// Raw strings below are real outputs captured from the deployed Morena endpoint.
describe('checkPartnerReply', () => {
  it('keeps only the first line when the model runs on', () => {
    const raw = 'Mo ní tòmátì tuntun, ó sì dára gan-an!\n\n<|assistant|>Ẹ ṣé.\n```python\nimport aiohttp';
    expect(checkPartnerReply(raw, opts)).toEqual({ reply: 'Mo ní tòmátì tuntun, ó sì dára gan-an!', reason: 'ok' });
  });

  it('truncates to the sentence limit for the level', () => {
    const raw = 'Muna da tummeric. Kuma barkono yana nan. Me kake so?';
    expect(checkPartnerReply(raw, { ...opts, userMessage: 'x' }).reply).toBe('Muna da tummeric.');
    expect(checkPartnerReply(raw, { ...opts, userMessage: 'x', level: 'intermediate' }).reply)
      .toBe('Muna da tummeric. Kuma barkono yana nan.');
  });

  it.each([
    ['', 'empty'],
    ['Ẹ ṣé <[...]>', 'markup'],
    ['Mo ní àtààrò (tomatoes) tuntun.', 'markup'],
    ['Na gode! Yau muna da:\n- tuwo\n- suya', 'incomplete'],
    ['{"reply": "Ẹ ṣé"}', 'markup'],
    ['Onye ahịa: Tomato dị ₦1,500 maka otu.', 'speaker-label'],
    ['Ìtumọ̀ náà ni translation', 'meta'],
    ['Sannu, lafiya lau. Sannu, lafiya lau.', 'repetition'],
    ['Pleased to meet you! How are you? I get the best tummeric and pepper today.', 'english'],
    ['Ẹ ṣé. Kí lẹ ní lónìí?', 'echo-user'],
  ])('rejects %j as %s', (raw, reason) => {
    expect(checkPartnerReply(raw, opts)).toEqual({ reply: null, reason });
  });

  it('allows restating its own earlier line (e.g. repeating the menu when asked)', () => {
    expect(checkPartnerReply('Ẹ wá ra nǹkan tuntun?', opts).reason).toBe('ok');
  });

  it('does not count a short opening interjection toward the sentence limit', () => {
    // Real Tiny Aya output; a plain one-sentence cut kept only "Daalụ!".
    const raw = 'Daalụ! Anyị nwere ọtụtụ nri dị mma taa, dị ka ofe egusi. Kedu ihe ị chọrọ?';
    expect(checkPartnerReply(raw, { ...opts, userMessage: 'x' }).reply)
      .toBe('Daalụ! Anyị nwere ọtụtụ nri dị mma taa, dị ka ofe egusi.');
  });

  it("strips the character's own name label but rejects any other label", () => {
    const rabi = getScenarioById('hausa-restaurant')!;
    const o = { level: 'beginner' as const, userMessage: 'x', scenario: rabi };
    expect(checkPartnerReply('Mama Rabi: Tuwo shinkafa da miyan kuka, da kuma suya mai kyau!', o))
      .toEqual({ reply: 'Tuwo shinkafa da miyan kuka, da kuma suya mai kyau!', reason: 'ok' });
    expect(checkPartnerReply('Customer: Ina son tuwo.', o).reason).toBe('speaker-label');
  });

  it('rejects over-long replies', () => {
    expect(checkPartnerReply('Mo ní ' + 'tòmátì '.repeat(30) + '.', opts).reason).toBe('too-long');
  });
});
