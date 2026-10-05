import { describe, expect, it } from 'vitest';
import { CONSENT_VERSION, reviewMessages, ShareConversationSchema } from './research-sharing';

describe('adult conversation sharing', () => {
  const base = { scenarioId: 'market-haggling', proficiencyLevel: 'beginner', adultConfirmed: true, consented: true, consentVersion: CONSENT_VERSION, messages: [{ role: 'ai', content: 'Hello' }, { role: 'user', content: 'I want tomatoes' }] };

  it('rejects a missing adult confirmation or consent', () => {
    expect(ShareConversationSchema.safeParse({ ...base, adultConfirmed: false }).success).toBe(false);
    expect(ShareConversationSchema.safeParse({ ...base, consented: false }).success).toBe(false);
  });

  it('drops aside turns and redacts contact details from shared text', () => {
    const messages = ShareConversationSchema.parse({ ...base, messages: [
      { role: 'ai', content: 'Hello' },
      { role: 'user', content: 'Write me at a@example.com or https://example.com' },
      { role: 'ai', content: 'Try this', kind: 'aside-answer' },
    ] }).messages;
    const shared = reviewMessages(messages);
    expect(shared).toHaveLength(2);
    expect(JSON.stringify(shared)).not.toContain('a@example.com');
    expect(JSON.stringify(shared)).not.toContain('https://example.com');
  });
});
