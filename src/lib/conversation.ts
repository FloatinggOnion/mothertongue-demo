import { Message } from '@/types';

/**
 * Single source of truth for distinguishing roleplay messages from
 * conversation asides. Absent `kind` means roleplay — this preserves
 * backward compatibility with sessions persisted before asides existed.
 */
export function isRoleplayMessage(m: Message): boolean {
  return m.kind === undefined || m.kind === 'roleplay';
}

/**
 * Filters a message list down to roleplay-only entries, preserving
 * relative order. Used everywhere a payload is built for an LLM call
 * (partner reply, suggestions, evaluation, level assessment) so that
 * asides never pollute the scenario thread.
 */
export function roleplayHistory(messages: Message[]): Message[] {
  return messages.filter(isRoleplayMessage);
}
