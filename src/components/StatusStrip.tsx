'use client';

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
      <div className="px-6 py-1.5 flex items-center gap-2.5 h-9">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" />
          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:-.3s]" />
          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:-.5s]" />
        </div>
        <span className="text-xs text-amber-400/80 italic font-medium">Evaluating your session...</span>
      </div>
    );
  }

  if (isListening) {
    return (
      <div className="px-6 py-1.5 flex items-center gap-2.5 h-9">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
        <span className="text-[11px] text-emerald-400 uppercase tracking-widest font-semibold">Listening</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-6 py-1.5 flex items-center gap-2.5 h-9 animate-pulse">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-.3s]" />
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-.5s]" />
        </div>
        <span className="text-xs text-emerald-400/80 italic font-medium">
          {isFirstMessage
            ? 'AI is waking up (this takes ~30s the first time)...'
            : 'Generating response...'}
        </span>
      </div>
    );
  }

  if (isSpeaking) {
    return (
      <div className="px-6 py-1.5 flex items-center gap-2.5 h-9">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex-1">
          {usingFallback ? 'Local Voice Active' : 'AI Voice Streaming'}
        </span>
        <button
          onClick={onStop}
          className="text-[10px] text-red-400/70 hover:text-red-400 underline decoration-dotted"
        >
          Stop Audio
        </button>
      </div>
    );
  }

  return <div className="h-9" />;
}
