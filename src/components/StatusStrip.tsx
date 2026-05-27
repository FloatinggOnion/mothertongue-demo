'use client';

/* Hallmark · component: StatusStrip · genre: editorial · theme: custom (Mother Tongue)
 * states: evaluating · listening · loading · speaking
 */

interface StatusStripProps {
  isListening: boolean;
  isLoading: boolean;
  isSpeaking: boolean;
  isEvaluating: boolean;
  usingFallback: boolean;
  isFirstMessage: boolean;
  onStop: () => void;
}

export function StatusStrip({
  isListening,
  isLoading,
  isSpeaking,
  isEvaluating,
  usingFallback,
  isFirstMessage,
  onStop,
}: StatusStripProps) {
  if (isEvaluating) {
    return (
      <div className="px-6 py-1.5 flex items-center gap-3 h-9 animate-fade-in duration-base">
        <div className="flex gap-1.5">
          <div className="w-1.5 h-1.5 bg-accent-warm rounded-full animate-bounce" />
          <div className="w-1.5 h-1.5 bg-accent-warm rounded-full animate-bounce [animation-delay:-.3s]" />
          <div className="w-1.5 h-1.5 bg-accent-warm rounded-full animate-bounce [animation-delay:-.5s]" />
        </div>
        <span className="font-ui text-caption text-accent-warm italic">Evaluating your session...</span>
      </div>
    );
  }

  if (isListening) {
    return (
      <div className="px-6 py-1.5 flex items-center gap-3 h-9 animate-fade-in duration-base">
        <span className="flex h-2 w-2 rounded-full bg-accent animate-ping" />
        <span className="font-ui text-label text-accent uppercase tracking-widest font-semibold">Listening</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-6 py-1.5 flex items-center gap-3 h-9 animate-fade-in duration-base">
        <div className="flex gap-1.5">
          <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
          <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-.3s]" />
          <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-.5s]" />
        </div>
        <span className="font-ui text-caption text-accent italic">
          {isFirstMessage
            ? 'AI is waking up (this takes ~30s the first time)...'
            : 'Generating response...'}
        </span>
      </div>
    );
  }

  if (isSpeaking) {
    return (
      <div className="px-6 py-1.5 flex items-center gap-3 h-9 animate-fade-in duration-base">
        <span className="flex h-2 w-2 rounded-full bg-accent-cool animate-ping" />
        <span className="font-ui text-label text-dark uppercase tracking-widest font-semibold flex-1">
          {usingFallback ? 'Local Voice Active' : 'AI Voice Streaming'}
        </span>
        <button
          onClick={onStop}
          className="font-ui text-label text-text-secondary hover:text-accent-warm underline decoration-dotted transition-colors"
        >
          Stop Audio
        </button>
      </div>
    );
  }

  return <div className="h-9" />;
}
