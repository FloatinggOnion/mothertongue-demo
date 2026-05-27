'use client';

import { useEffect, useState } from 'react';

interface EvaluationLoadingProps {
  isVisible: boolean;
}

export function EvaluationLoading({ isVisible }: EvaluationLoadingProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTime;
      setElapsedMs(elapsed);
    }, 100);

    return () => clearInterval(interval);
  }, [isVisible, startTime]);

  if (!isVisible) {
    return null;
  }

  // Estimate attempt number based on elapsed time
  // Backoff windows: 2-4s (attempt 1), 8-16s (attempt 2), 32-64s (attempt 3)
  // Use cumulative: < 3s = evaluating, 3-10s = attempt 1, 10-20s = attempt 2, 20s+ = attempt 3
  let status = 'Evaluating...';
  let isRetrying = false;

  if (elapsedMs > 3000) {
    isRetrying = true;
    status = 'Retrying... (attempt 1 of 3)';
  }
  if (elapsedMs > 10000) {
    status = 'Retrying... (attempt 2 of 3)';
  }
  if (elapsedMs > 20000) {
    status = 'Retrying... (attempt 3 of 3)';
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-[var(--color-paper)] rounded-3xl max-w-lg w-full p-6 md:p-8 border border-[var(--color-divider)] shadow-2xl">
        <div className="text-center">
          {/* Terracotta ink-spread style loading indicator */}
          <div className="flex justify-center mb-8">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 bg-[var(--color-accent)] rounded-full opacity-20 animate-pulse-ring" />
              <div className="absolute inset-3 bg-[var(--color-accent)] rounded-full" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">{status}</h2>

          {/* Loading spinner */}
          <div className="flex justify-center mb-4">
            <div className="w-8 h-8 border-4 border-[var(--color-divider)] border-t-[var(--color-accent)] rounded-full animate-spin" />
          </div>

          <p className="text-[var(--color-text-secondary)] text-sm">
            {isRetrying
              ? 'The AI is taking longer than usual. Still working on your feedback...'
              : 'Analyzing your conversation...'}
          </p>
        </div>
      </div>
    </div>
  );
}
