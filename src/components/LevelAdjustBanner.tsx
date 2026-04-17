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
  const icon = isUpgrade ? '🚀' : '🎯';
  const label = isUpgrade ? 'Ready for a challenge?' : 'Take it a bit easier?';

  return (
    <div className="mx-4 mb-2 bg-slate-800/80 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-300">
      <span className="text-xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium">{label}</p>
        <p className="text-slate-400 text-[11px] truncate">{rationale}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onDismiss}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1"
        >
          Not now
        </button>
        <button
          onClick={onAccept}
          className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-lg transition-colors font-medium"
        >
          Try {LEVEL_LABELS[to]}
        </button>
      </div>
    </div>
  );
}
