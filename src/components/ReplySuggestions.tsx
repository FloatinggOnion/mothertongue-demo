'use client';

import { ReplySuggestion } from '@/types';

interface ReplySuggestionsProps {
  suggestions: ReplySuggestion[];
  onSelect: (text: string) => void;
  isVisible: boolean;
}

export function ReplySuggestions({
  suggestions,
  onSelect,
  isVisible,
}: ReplySuggestionsProps) {
  if (!isVisible || suggestions.length === 0) return null;

  return (
    <div className="animate-fade-in px-4 py-3 border-t border-white/10">
      <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
        <span className="text-amber-400">💡</span>
        Need help? Try one of these:
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelect(suggestion.text)}
            className="group relative bg-white/5 hover:bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm text-white transition-all hover:scale-105"
          >
            <span>{suggestion.text}</span>
            {/* Translation tooltip */}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-slate-800 text-xs text-slate-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700">
              {suggestion.translation}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
