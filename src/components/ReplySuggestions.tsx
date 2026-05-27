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
    <div className="animate-fade-in px-6 py-4 border-t border-divider bg-surface/80 backdrop-blur-sm rounded-sm">
      <div className="font-ui text-[10px] uppercase tracking-widest text-text-secondary mb-4">
        Possible replies
      </div>
      <div className="flex flex-wrap gap-3">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelect(suggestion.text)}
            className="group relative bg-paper hover:bg-surface border border-divider rounded-sm px-4 py-2 font-body text-sm text-text transition-all duration-fast ease-out hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span>{suggestion.text}</span>

            {/* Clean translation tooltip on hover — no label */}
            {suggestion.translation && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[var(--color-dark)] text-[var(--color-text-inverse)] font-ui text-[11px] rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap pointer-events-none shadow-md">
                {suggestion.translation}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}