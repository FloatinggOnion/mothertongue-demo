import { z } from 'zod';

export const CONSENT_VERSION = '2026-10-05';
// The daily cleanup may run up to 24 hours after expiry. Expire on day 29 so
// the scheduled deletion normally finishes within the promised 30 days.
export const REVIEW_RETENTION_DAYS = 29;

export const ShareConversationSchema = z.object({
  scenarioId: z.string().min(1).max(80),
  proficiencyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  adultConfirmed: z.literal(true),
  consented: z.literal(true),
  consentVersion: z.literal(CONSENT_VERSION),
  messages: z.array(z.object({
    role: z.enum(['user', 'ai']),
    content: z.string().trim().min(1).max(1200),
    kind: z.enum(['roleplay', 'aside-question', 'aside-answer']).optional(),
  })).min(2).max(60),
});

export function reviewSharingConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_RESEARCH_SHARING_ENABLED === 'true' &&
    process.env.NEON_DATABASE_URL &&
    process.env.CRON_SECRET
  );
}

export function reviewMessages(messages: z.infer<typeof ShareConversationSchema>['messages']) {
  return messages
    .filter((message) => !message.kind || message.kind === 'roleplay')
    .map(({ role, content }) => ({ role, content: redactContactDetails(content) }));
}

export function redactContactDetails(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email removed]')
    .replace(/https?:\/\/\S+/gi, '[link removed]')
    .replace(/(?:\+?\d[\s.-]?){8,}/g, '[number removed]');
}
