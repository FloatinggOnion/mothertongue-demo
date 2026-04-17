import { Message, ProficiencyLevel } from '@/types';

const VERSION = 1;

interface PersistedSession {
  version: number;
  messages: Message[];
  proficiencyLevel: ProficiencyLevel;
  manualOverride: boolean;
  turnScores: number[];
  totalSpeakingTime: number;
  startingLevel: ProficiencyLevel;
  startedAt: number;
}

function key(scenarioId: string) {
  return `mt:drill:${scenarioId}`;
}

export function loadSession(scenarioId: string): PersistedSession | null {
  try {
    const raw = localStorage.getItem(key(scenarioId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== VERSION) return null;
    return parsed as PersistedSession;
  } catch {
    return null;
  }
}

export function saveSession(
  scenarioId: string,
  session: Omit<PersistedSession, 'version'>
): void {
  try {
    localStorage.setItem(key(scenarioId), JSON.stringify({ ...session, version: VERSION }));
  } catch {
    // ignore quota errors
  }
}

export function clearSession(scenarioId: string): void {
  try {
    localStorage.removeItem(key(scenarioId));
  } catch {
    // ignore
  }
}
