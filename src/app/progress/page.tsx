'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { getScenarioById } from '@/config/scenarios';
import type { UserProgress } from '@/lib/progress';

export default function ProgressPage() {
  return (
    <main className="min-h-screen bg-paper text-dark px-6 py-12 md:py-20">
      <div className="max-w-3xl mx-auto">
        <Link href="/scenarios" className="font-ui text-xs uppercase tracking-widest text-accent hover:underline">← Scenarios</Link>
        <h1 className="font-display text-4xl md:text-5xl mt-8 mb-4">Your progress</h1>
        <p className="font-body text-text-secondary mb-10">A record of the conversations you chose to save.</p>
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
          ? <ConfiguredProgress />
          : <p className="font-body text-sm text-text-secondary">Account saving is being set up. You can still practice without signing in.</p>}
      </div>
    </main>
  );
}

function ConfiguredProgress() {
  const { isLoaded, isSignedIn } = useAuth();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const controller = new AbortController();
    fetch('/api/progress', { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Could not load progress');
        setProgress(body as UserProgress);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load progress');
      });
    return () => controller.abort();
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) return <p className="font-body text-sm">Loading your account…</p>;
  if (!isSignedIn) return <Link href="/sign-in?returnTo=%2Fprogress" className="inline-block bg-accent px-5 py-3 text-text-inverse font-ui text-xs uppercase tracking-widest">Sign in with email code</Link>;
  if (error) return <p role="alert" className="font-body text-sm text-red-700">{error}</p>;
  if (!progress) return <p className="font-body text-sm">Loading your progress…</p>;

  const records = Object.values(progress.scenarios).sort((a, b) => b.lastSavedAt.localeCompare(a.lastSavedAt));
  if (records.length === 0) return <p className="font-body text-sm text-text-secondary">No saved conversations yet. Choose a scenario, practice, and save when you are ready.</p>;

  return (
    <div className="space-y-4">
      {records.map((record) => {
        const scenario = getScenarioById(record.scenarioId);
        return (
          <article key={record.scenarioId} className="bg-surface border border-divider p-5 md:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-ui text-[10px] uppercase tracking-widest text-accent mb-2">{record.language}</p>
              <h2 className="font-display text-xl mb-1">{scenario?.title ?? record.scenarioId}</h2>
              <p className="font-body text-sm text-text-secondary">{record.proficiencyLevel} · {record.turnCount} learner turns · {record.sessionsSaved} saved {record.sessionsSaved === 1 ? 'session' : 'sessions'}</p>
            </div>
            {scenario && <Link href={`/drill/${scenario.id}`} className="font-ui text-xs uppercase tracking-widest text-accent hover:underline shrink-0">Practice again →</Link>}
          </article>
        );
      })}
    </div>
  );
}
