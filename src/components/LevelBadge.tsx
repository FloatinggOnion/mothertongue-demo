'use client';

import { useState, useRef, useEffect } from 'react';
import { ProficiencyLevel } from '@/types';

const LEVEL_COLORS: Record<ProficiencyLevel, string> = {
  beginner: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  intermediate: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  advanced: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
};

const LEVEL_LABELS: Record<ProficiencyLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

interface LevelBadgeProps {
  level: ProficiencyLevel;
  manualOverride: boolean;
  onLevelChange: (level: ProficiencyLevel) => void;
  onClearOverride: () => void;
}

export function LevelBadge({ level, manualOverride, onLevelChange, onClearOverride }: LevelBadgeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${LEVEL_COLORS[level]}`}
      >
        {manualOverride && <span title="Level locked">🔒</span>}
        {LEVEL_LABELS[level]}
        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-50 min-w-[180px] py-1 animate-in fade-in zoom-in-95 duration-150">
          {(['beginner', 'intermediate', 'advanced'] as ProficiencyLevel[]).map((l) => (
            <button
              key={l}
              onClick={() => { onLevelChange(l); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/10 ${
                l === level ? 'text-white font-medium' : 'text-slate-400'
              }`}
            >
              {l === level ? '✓ ' : '  '}{LEVEL_LABELS[l]}
            </button>
          ))}
          {manualOverride && (
            <>
              <div className="border-t border-white/10 my-1" />
              <button
                onClick={() => { onClearOverride(); setOpen(false); }}
                className="w-full text-left px-4 py-2 text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
              >
                Let the app decide
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
