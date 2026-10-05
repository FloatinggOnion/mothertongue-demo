import { describe, expect, it } from 'vitest';
import { MeasurementEventSchema, measurementProperties } from './measurement';

describe('measurement event allowlist', () => {
  const base = { sessionId: '8aa4e9fc-04f0-489a-b51b-f7721e4758b7', scenarioId: 'market-haggling', event: 'partner_reply_succeeded' };

  it('rejects conversation text and arbitrary personal data', () => {
    expect(MeasurementEventSchema.safeParse({ ...base, content: 'My private message' }).success).toBe(false);
    expect(MeasurementEventSchema.safeParse({ ...base, email: 'someone@example.com' }).success).toBe(false);
  });

  it('builds only bounded structured properties', () => {
    const event = MeasurementEventSchema.parse({ ...base, turnIndex: 2, durationMs: 4321 });
    expect(measurementProperties(event, 'yoruba')).toEqual({
      scenario_id: 'market-haggling', language: 'yoruba', turn_index: 2, duration_ms: 4321, $process_person_profile: false,
    });
  });
});
