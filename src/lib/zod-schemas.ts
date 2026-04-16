import { z } from 'zod';

// Shared schemas
const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'ai']),
  content: z.string(),
  timestamp: z.number(),
  translation: z.string().optional(),
});

const ProficiencyLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);

// Route-specific schemas

export const ChatSchema = z.object({
  scenarioId: z.string().min(1, 'scenarioId is required'),
  proficiencyLevel: ProficiencyLevelSchema,
  conversationHistory: z.array(MessageSchema),
  userMessage: z.string().min(1, 'userMessage is required'),
});

export const EvaluateSchema = z.object({
  scenarioId: z.string().min(1, 'scenarioId is required'),
  messages: z.array(MessageSchema).min(1, 'messages array must not be empty'),
});

export const SuggestionsSchema = z.object({
  scenarioId: z.string().min(1, 'scenarioId is required'),
  proficiencyLevel: ProficiencyLevelSchema,
  conversationHistory: z.array(MessageSchema),
  lastAiMessage: z.string().min(1, 'lastAiMessage is required'),
});

export const TtsSchema = z.object({
  text: z.string().min(1, 'text is required'),
  gender: z.enum(['male', 'female']).optional(),
});

// Type exports for runtime use
export type ChatRequest = z.infer<typeof ChatSchema>;
export type EvaluateRequest = z.infer<typeof EvaluateSchema>;
export type SuggestionsRequest = z.infer<typeof SuggestionsSchema>;
export type TtsRequest = z.infer<typeof TtsSchema>;

// Helper to extract field error message
export function getZodErrorMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  const field = issue.path.length > 0 ? issue.path.join('.') : 'request';
  return `${field} ${issue.message || 'is invalid'}`;
}
