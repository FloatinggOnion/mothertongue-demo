import { describe, it, expect } from 'vitest';
import { Message } from '@/types';
import { isRoleplayMessage, roleplayHistory } from '@/lib/conversation';

function msg(overrides: Partial<Message>): Message {
  return {
    id: overrides.id ?? 'id',
    role: overrides.role ?? 'user',
    content: overrides.content ?? 'hello',
    timestamp: overrides.timestamp ?? Date.now(),
    ...overrides,
  };
}

describe('isRoleplayMessage', () => {
  it('returns true for a message with no kind (back-compat)', () => {
    const m = msg({ id: '1' });
    expect(isRoleplayMessage(m)).toBe(true);
  });

  it("returns true for kind: 'roleplay'", () => {
    const m = msg({ id: '1', kind: 'roleplay' });
    expect(isRoleplayMessage(m)).toBe(true);
  });

  it("returns false for kind: 'aside-question'", () => {
    const m = msg({ id: '1', kind: 'aside-question' });
    expect(isRoleplayMessage(m)).toBe(false);
  });

  it("returns false for kind: 'aside-answer'", () => {
    const m = msg({ id: '1', kind: 'aside-answer' });
    expect(isRoleplayMessage(m)).toBe(false);
  });
});

describe('roleplayHistory', () => {
  it('drops aside-question/aside-answer entries and preserves relative order', () => {
    const messages: Message[] = [
      msg({ id: '1', role: 'ai', content: 'starter' }),
      msg({ id: '2', role: 'user', content: 'roleplay turn 1' }),
      msg({ id: '3', role: 'ai', content: 'roleplay reply 1' }),
      msg({ id: '4', role: 'user', content: 'how do I say tomato?', kind: 'aside-question' }),
      msg({ id: '5', role: 'ai', content: 'Tomati means tomato', kind: 'aside-answer' }),
      msg({ id: '6', role: 'user', content: 'roleplay turn 2' }),
    ];

    const result = roleplayHistory(messages);

    expect(result.map((m) => m.id)).toEqual(['1', '2', '3', '6']);
  });
});
