'use client';

import { useRef } from 'react';

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
  // Track whether the press came from mouse/touch so onClick doesn't double-fire
  const pressedRef = useRef(false);

  const handleMouseDown = () => {
    if (isDisabled) return;
    pressedRef.current = true;
    if (!isListening) onPress();
  };

  const handleMouseUp = () => {
    if (isDisabled) return;
    if (isListening) onRelease();
    pressedRef.current = false;
  };

  const handleMouseLeave = () => {
    if (isDisabled) return;
    if (isListening) {
      onRelease();
      pressedRef.current = false;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (isDisabled) return;
    pressedRef.current = true;
    if (!isListening) onPress();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (isDisabled) return;
    if (isListening) onRelease();
    pressedRef.current = false;
  };

  // onClick only fires if mousedown/touchstart didn't already handle it
  // This covers edge cases where pointer events don't fire properly
  const handleClick = () => {
    if (isDisabled || pressedRef.current) return;
    if (isListening) {
      onRelease();
    } else {
      onPress();
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        disabled={isDisabled}
        className={`
          relative w-20 h-20 rounded-full flex items-center justify-center
          transition-all duration-200 touch-none select-none
          ${
            isDisabled
              ? 'bg-[#A89B8C] cursor-not-allowed opacity-50'
              : isListening
                ? 'bg-[#2C1810] scale-110 shadow-lg shadow-[#2C1810]/40'
                : 'bg-[#C4622D] hover:scale-105 shadow-lg shadow-[#C4622D]/30'
          }
        `}
      >
        {/* Pulse animation when listening */}
        {isListening && (
          <>
            <div className="absolute inset-0 rounded-full bg-[#2C1810]/50 animate-ping" />
            <div className="absolute inset-0 rounded-full bg-[#2C1810]/30 animate-pulse" />
          </>
        )}

        {/* Loading spinner */}
        {isLoading ? (
          <div className="w-8 h-8 border-2 border-[#F5F0E8]/30 border-t-[#F5F0E8] rounded-full animate-spin" />
        ) : (
          <svg
            className="w-8 h-8 text-[#F5F0E8] relative z-10"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>

      {/* Status text */}
      <div className="font-ui text-[10px] uppercase tracking-widest text-[#A89B8C]">
        {isLoading ? (
          'Processing...'
        ) : isSpeaking ? (
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#C4622D] rounded-full animate-pulse" />
            Speaking...
          </span>
        ) : isListening ? (
          <span className="text-[#2C1810] font-medium">Tap to stop</span>
        ) : (
          'Hold to speak'
        )}
      </div>
    </div>
  );
}