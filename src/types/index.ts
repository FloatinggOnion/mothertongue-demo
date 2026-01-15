// Core types for Mothertongue

export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Scenario {
  id: string;
  title: string;
  titleYoruba: string;
  description: string;
  icon: string;
  context: string;
  aiRole: string;
  aiRoleYoruba: string;
  starterPrompt: string;
  difficulty: ProficiencyLevel;
  gender: 'male' | 'female';
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  translation?: string;
  timestamp: number;
}

export interface ConversationMetrics {
  speakingTimeSeconds: number;
  turnCount: number;
  meaningUnderstoodRate: number;
  userUtterances: number;
  aiUtterances: number;
}

export interface Evaluation {
  strength: string;
  strengthExample?: string;
  improvement: string;
  correctedSentence: string;
  overallScore: number; // 1-10
  fluencyScore: number;
  grammarScore: number;
  confidenceScore: number;
}

export interface DrillSession {
  id: string;
  scenarioId: string;
  proficiencyLevel: ProficiencyLevel;
  messages: Message[];
  metrics: ConversationMetrics;
  evaluation?: Evaluation;
  startTime: number;
  endTime?: number;
  isActive: boolean;
}

export interface ReplySuggestion {
  text: string;
  translation: string;
}

export interface GeminiResponse {
  reply: string;
  translation: string;
  suggestions?: ReplySuggestion[];
  shouldEndDrill?: boolean;
}

export interface SilentEvaluation {
  meaningUnderstood: boolean;
  fluencyNote?: string;
  grammarNote?: string;
  confidenceNote?: string;
}
