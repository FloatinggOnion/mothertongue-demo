'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { ProficiencyLevel } from '@/types';
import { measure } from '@/lib/measurement-client';

interface Props {
  scenarioId: string;
  proficiencyLevel: ProficiencyLevel;
  turnCount: number;
  sessionKey: string;
}

export function SaveProgressAction(props: Props) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;
  return <ConfiguredSaveProgressAction {...props} />;
}

function ConfiguredSaveProgressAction({ scenarioId, proficiencyLevel, turnCount, sessionKey }: Props) {
  const { isLoaded, isSignedIn } = useAuth();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  const save = async () => {
    if (!isLoaded || savingRef.current || !sessionKey) return;
    if (!isSignedIn) {
      const returnTo = `/drill/${encodeURIComponent(scenarioId)}?save=1`;
      window.location.assign(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    savingRef.current = true;
    setStatus('saving');
    setError('');
    measure({ event: 'save_requested', sessionId: sessionKey, scenarioId, proficiencyLevel, turnIndex: turnCount });
    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId, proficiencyLevel, turnCount, sessionKey }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save progress');
      setStatus('saved');
      measure({ event: 'save_succeeded', sessionId: sessionKey, scenarioId, proficiencyLevel, turnIndex: turnCount });
      const url = new URL(window.location.href);
      if (url.searchParams.get('save') === '1') {
        url.searchParams.delete('save');
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch (cause) {
      setStatus('error');
      measure({ event: 'save_failed', sessionId: sessionKey, scenarioId, proficiencyLevel, turnIndex: turnCount });
      setError(cause instanceof Error ? cause.message : 'Could not save progress');
    } finally {
      savingRef.current = false;
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn && turnCount > 0 && new URL(window.location.href).searchParams.get('save') === '1') {
      const timer = window.setTimeout(() => void save(), 0);
      return () => window.clearTimeout(timer);
    }
    // A sign-in return should save once. The query parameter is removed after success.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, turnCount]);

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => void save()}
        disabled={!isLoaded || status === 'saving'}
        className="font-ui text-label uppercase tracking-widest px-4 py-2 border border-accent text-accent hover:bg-accent hover:text-text-inverse transition-colors disabled:opacity-50"
      >
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save progress'}
      </button>
      {status === 'error' && <span role="alert" className="font-body text-xs text-red-700 max-w-44 text-center">{error}</span>}
    </div>
  );
}
