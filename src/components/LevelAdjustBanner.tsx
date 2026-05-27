'use client';

import { ProficiencyLevel } from '@/types';

const LEVEL_LABELS: Record<ProficiencyLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

interface LevelAdjustBannerProps {
  from: ProficiencyLevel;
  to: ProficiencyLevel;
  rationale: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export function LevelAdjustBanner({ from, to, rationale, onAccept, onDismiss }: LevelAdjustBannerProps) {
  const isUpgrade = (
    (from === 'beginner' && (to === 'intermediate' || to === 'advanced')) ||
    (from === 'intermediate' && to === 'advanced')
  );
  const label = isUpgrade ? 'Ready for a challenge?' : 'Take it a bit easier?';

  return (
    <div className="mx-4 mb-2 bg-[var(--color-surface)] border border-[var(--color-divider)] rounded-xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex-1 min-w-0">
        <p className="text-[var(--color-text)] text-xs font-medium">{label}</p>
        <p className="text-[var(--color-text-secondary)] text-[11px] truncate">{rationale}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onDismiss}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors px-2 py-1"
        >
          Not now
        </button>
        <button
          onClick={onAccept}
          className="text-xs bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/20 px-3 py-1 rounded-lg transition-colors font-medium"
        >
          Try {LEVEL_LABELS[to]}
        </button>
      </div>
    </div>
  );
}
