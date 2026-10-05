'use client';

import { ReplySuggestion } from '@/types';

interface ReplySuggestionsProps {
  suggestions: ReplySuggestion[];
  step: 1 | 2 | 3;
  onAdvance: () => void;
  onSelect: (text: string) => void;
  isVisible: boolean;
}

export function ReplySuggestions({
  suggestions,
  step,
  onAdvance,
  onSelect,
  isVisible,
}: ReplySuggestionsProps) {
  if (!isVisible || suggestions.length === 0) return null;

  return (
    <div className="animate-fade-in w-full px-6 py-4 border-t border-divider bg-surface/80 backdrop-blur-sm rounded-sm" aria-live="polite">
      <div className="font-ui text-[10px] uppercase tracking-widest text-text-secondary mb-4">
        {step === 1 ? 'A nudge' : step === 2 ? 'What you could say' : 'Phrases you can use'}
      </div>
      <div className="flex flex-col gap-3">
        {suggestions.map((suggestion, index) => (
          <div key={index} className="bg-paper border border-divider rounded-sm px-4 py-3">
            {step === 1 && <p className="font-body text-sm text-text">{suggestion.label || `Idea ${index + 1}: respond to the last message`}</p>}
            {step === 2 && <p className="font-body text-sm text-text">{suggestion.translation || suggestion.label || 'Think about your answer.'}</p>}
            {step === 3 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-body text-sm text-text">{suggestion.text}</p>
                  {suggestion.translation && <p className="font-ui text-xs text-text-secondary mt-1">{suggestion.translation}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(suggestion.text)}
                  className="font-ui text-xs text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Use as draft
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {step < 3 && (
        <button
          type="button"
          onClick={onAdvance}
          className="mt-4 font-ui text-xs text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {step === 1 ? 'Show meanings' : 'Show phrases'}
        </button>
      )}
    </div>
  );
}
