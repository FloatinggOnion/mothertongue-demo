import { z } from 'zod';

const eventNames = [
  'scenario_started',
  'learner_turn_sent',
  'partner_reply_succeeded',
  'partner_reply_failed',
  'reply_understood',
  'hint_opened',
  'hint_step_revealed',
  'session_finished',
  'save_requested',
  'save_succeeded',
  'save_failed',
] as const;

export const MeasurementEventSchema = z.object({
  sessionId: z.string().uuid(),
  scenarioId: z.string().min(1).max(80),
  proficiencyLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  event: z.enum(eventNames),
  turnIndex: z.number().int().min(0).max(100).optional(),
  inputMode: z.enum(['text', 'voice']).optional(),
  durationMs: z.number().int().min(0).max(180000).optional(),
  answer: z.enum(['yes', 'no']).optional(),
  reason: z.enum(['missed_meaning', 'changed_topic', 'wrong_language', 'unnatural', 'other']).optional(),
  hintStep: z.number().int().min(1).max(3).optional(),
}).strict();

export type MeasurementEvent = z.infer<typeof MeasurementEventSchema>;

export function analyticsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true' && process.env.POSTHOG_PROJECT_KEY && process.env.POSTHOG_HOST);
}

export function measurementProperties(event: MeasurementEvent, language: string) {
  return {
    scenario_id: event.scenarioId,
    language,
    ...(event.proficiencyLevel === undefined ? {} : { proficiency_level: event.proficiencyLevel }),
    ...(event.turnIndex === undefined ? {} : { turn_index: event.turnIndex }),
    ...(event.inputMode === undefined ? {} : { input_mode: event.inputMode }),
    ...(event.durationMs === undefined ? {} : { duration_ms: event.durationMs }),
    ...(event.answer === undefined ? {} : { answer: event.answer }),
    ...(event.reason === undefined ? {} : { reason: event.reason }),
    ...(event.hintStep === undefined ? {} : { hint_step: event.hintStep }),
    $process_person_profile: false,
  };
}
