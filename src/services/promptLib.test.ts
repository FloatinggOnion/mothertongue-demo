import { describe, expect, it } from 'vitest';
import { getScenarioById } from '@/config/scenarios';
import { buildPartnerSystemPrompt } from './promptLib';

describe('partner prompt scene continuity', () => {
  const scenario = getScenarioById('market-haggling')!;

  it('gives the partner the actual scene and requires an answer to the latest learner turn', () => {
    const prompt = buildPartnerSystemPrompt(scenario, 'beginner', 'yoruba');
    expect(prompt).toContain(scenario.context);
    expect(prompt).toContain("First understand the learner's latest turn");
    expect(prompt).toContain('Do not restart with a generic greeting');
    expect(prompt).toContain('Use a second short sentence when needed');
  });

  it('does not bias the target-language reply with an English JSON example', () => {
    const prompt = buildPartnerSystemPrompt(scenario, 'beginner', 'yoruba');
    expect(prompt).not.toContain('Pleased to meet you!');
    expect(prompt).toContain('Target Language to Speak: Yoruba');
  });
});
