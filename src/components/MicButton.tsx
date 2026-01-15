'use client';

interface MicButtonProps {
  isListening: boolean;
  isSpeaking: boolean;
  isLoading: boolean;
  onPress: () => void;
  onRelease: () => void;
}

export function MicButton({
  isListening,
  isSpeaking,
  isLoading,
  onPress,
  onRelease,
}: MicButtonProps) {
  const isDisabled = isSpeaking || isLoading;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Main mic button */}
      <button
        onMouseDown={onPress}
        onMouseUp={onRelease}
        onMouseLeave={onRelease}
        onTouchStart={onPress}
        onTouchEnd={onRelease}
        disabled={isDisabled}
        className={`
          relative w-20 h-20 rounded-full flex items-center justify-center
          transition-all duration-200 touch-none select-none
          ${
            isDisabled
              ? 'bg-slate-700 cursor-not-allowed opacity-50'
              : isListening
                ? 'bg-gradient-to-r from-red-500 to-rose-500 scale-110 shadow-lg shadow-red-500/50'
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-105 shadow-lg shadow-emerald-500/30'
          }
        `}
      >
        {/* Pulse animation when listening */}
        {isListening && (
          <>
            <div className="absolute inset-0 rounded-full bg-red-500/50 animate-ping" />
            <div className="absolute inset-0 rounded-full bg-red-500/30 animate-pulse" />
          </>
        )}

        {/* Loading spinner */}
        {isLoading ? (
          <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <svg
            className="w-8 h-8 text-white relative z-10"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>

      {/* Status text */}
      <div className="text-sm text-slate-400">
        {isLoading ? (
          'Processing...'
        ) : isSpeaking ? (
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            AI is speaking...
          </span>
        ) : isListening ? (
          <span className="text-red-400 font-medium">Release to send</span>
        ) : (
          'Hold to speak'
        )}
      </div>
    </div>
  );
}
