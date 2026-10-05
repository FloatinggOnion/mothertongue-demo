import { z } from 'zod';
import type { Scenario } from '@/types';

export const SaveProgressSchema = z.object({
  scenarioId: z.string().min(1),
  proficiencyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  turnCount: z.number().int().min(1).max(100),
  sessionKey: z.string().uuid(),
});

const ProgressRecordSchema = z.object({
  scenarioId: z.string(),
  language: z.enum(['yoruba', 'hausa', 'igbo']),
  proficiencyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  turnCount: z.number().int().min(1),
  sessionsSaved: z.number().int().min(1),
  sessionKey: z.string(),
  lastSavedAt: z.string(),
});

export const UserProgressSchema = z.object({
  version: z.literal(1),
  scenarios: z.record(z.string(), ProgressRecordSchema),
});

export type UserProgress = z.infer<typeof UserProgressSchema>;
export type SaveProgressInput = z.infer<typeof SaveProgressSchema>;

export function readUserProgress(value: unknown): UserProgress {
  const parsed = UserProgressSchema.safeParse(value);
  return parsed.success ? parsed.data : { version: 1, scenarios: {} };
}

export function mergeUserProgress(
  current: unknown,
  input: SaveProgressInput,
  scenario: Scenario,
  now: Date = new Date()
): UserProgress {
  const progress = readUserProgress(current);
  const previous = progress.scenarios[scenario.id];
  const sameSession = previous?.sessionKey === input.sessionKey;
  return {
    version: 1,
    scenarios: {
      ...progress.scenarios,
      [scenario.id]: {
        scenarioId: scenario.id,
        language: scenario.language,
        proficiencyLevel: input.proficiencyLevel,
        turnCount: input.turnCount,
        sessionsSaved: previous ? previous.sessionsSaved + (sameSession ? 0 : 1) : 1,
        sessionKey: input.sessionKey,
        lastSavedAt: now.toISOString(),
      },
    },
  };
}
