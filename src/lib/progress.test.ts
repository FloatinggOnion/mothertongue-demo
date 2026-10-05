import { describe, expect, it } from 'vitest';
import { getScenarioById } from '@/config/scenarios';
import { mergeUserProgress, readUserProgress } from './progress';

const market = getScenarioById('market-haggling')!;
const hausa = getScenarioById('hausa-market-haggling')!;
const input = {
  scenarioId: market.id,
  proficiencyLevel: 'beginner' as const,
  turnCount: 3,
  sessionKey: '1c559d34-1d2b-4a4c-aef4-6a726dce29bb',
};

describe('saved progress', () => {
  it('keeps the scenario language and counts one session only once', () => {
    const first = mergeUserProgress(null, input, market, new Date('2026-10-05T12:00:00Z'));
    const second = mergeUserProgress(first, { ...input, turnCount: 5 }, market, new Date('2026-10-05T12:05:00Z'));
    expect(second.scenarios[market.id]).toMatchObject({
      language: 'yoruba', turnCount: 5, sessionsSaved: 1,
    });
  });

  it('tracks Yoruba and Hausa scenarios separately', () => {
    const first = mergeUserProgress(null, input, market);
    const second = mergeUserProgress(first, {
      ...input, scenarioId: hausa.id, sessionKey: 'a2762eef-5656-4d98-b835-9d1fdc057552',
    }, hausa);
    expect(Object.keys(second.scenarios)).toEqual([market.id, hausa.id]);
    expect(second.scenarios[hausa.id].language).toBe('hausa');
  });

  it('falls back to an empty record for malformed metadata', () => {
    expect(readUserProgress({ version: 1, scenarios: { broken: { language: 'french' } } }))
      .toEqual({ version: 1, scenarios: {} });
  });
});
