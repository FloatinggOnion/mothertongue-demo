'use client';

import { Evaluation, ConversationMetrics, ProficiencyLevel } from '@/types';

const LEVEL_LABELS: Record<ProficiencyLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

type FeedbackCardProps =
  | {
      state: 'success';
      evaluation: Evaluation;
      metrics: ConversationMetrics;
      proficiencyLevel?: ProficiencyLevel;
      startingLevel?: ProficiencyLevel;
      onClose: () => void;
      onTryAgain: () => void;
    }
  | {
      state: 'error';
      errorMessage: string;
      onRetry: () => void;
      onClose: () => void;
    };

export function FeedbackCard(props: FeedbackCardProps) {
  if (props.state === 'error') {
    return <ErrorState {...props} />;
  }
  return <SuccessState {...props} />;
}

function SuccessState({
  evaluation,
  metrics,
  proficiencyLevel,
  startingLevel,
  onClose,
  onTryAgain,
}: Extract<FeedbackCardProps, { state: 'success' }>) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const scoreLabel =
    evaluation.overallScore >= 9
      ? 'Native-like — outstanding'
      : evaluation.overallScore >= 7
      ? 'Strong — minor polish left'
      : evaluation.overallScore >= 5
      ? 'Communicating well — keep going'
      : evaluation.overallScore >= 3
      ? 'Building the foundation — stay with it'
      : 'Early stage — every turn counts';

  const levelChanged = startingLevel && proficiencyLevel && startingLevel !== proficiencyLevel;
  const leveledUp = levelChanged && (
    (startingLevel === 'beginner' && proficiencyLevel !== 'beginner') ||
    (startingLevel === 'intermediate' && proficiencyLevel === 'advanced')
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl max-w-lg w-full p-6 md:p-8 border border-white/10 shadow-2xl my-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-1">Drill Complete!</h2>
          <p className="text-slate-400 text-sm">Here&apos;s how you did</p>
          {proficiencyLevel && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-xs text-slate-500">Finished at</span>
              <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                {LEVEL_LABELS[proficiencyLevel]}
              </span>
              {levelChanged && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  leveledUp
                    ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                    : 'text-sky-400 bg-sky-500/10 border border-sky-500/20'
                }`}>
                  {leveledUp ? '↑ leveled up' : '↓ adjusted'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Hero score */}
        <div className="flex flex-col items-center mb-5">
          <div className="text-5xl font-bold text-white">{evaluation.overallScore}<span className="text-2xl text-slate-500">/10</span></div>
          <p className="text-xs text-slate-400 mt-1">{scoreLabel}</p>
        </div>

        {/* Sub-scores */}
        <div className="mb-5 space-y-2">
          <ScoreBar label="Fluency" score={evaluation.fluencyScore} color="emerald" />
          <ScoreBar label="Grammar" score={evaluation.grammarScore} color="teal" />
          <ScoreBar label="Confidence" score={evaluation.confidenceScore} color="cyan" />
        </div>

        {/* Session stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-emerald-400">{formatTime(metrics.speakingTimeSeconds)}</div>
            <div className="text-xs text-slate-400">Speaking Time</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-teal-400">{metrics.turnCount}</div>
            <div className="text-xs text-slate-400">Turns</div>
          </div>
        </div>

        {/* Feedback */}
        <div className="space-y-4 mb-6">
          {/* Strength */}
          <div className="bg-emerald-500/15 border border-emerald-400/40 ring-1 ring-emerald-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">✓</span>
              <div>
                <div className="text-emerald-400 font-medium text-sm mb-1">
                  What you did well
                </div>
                <p className="text-white text-sm">{evaluation.strength}</p>
                {evaluation.strengthExample && (
                  <p className="text-emerald-300/80 text-xs mt-1 italic">
                    &quot;{evaluation.strengthExample}&quot;
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Improvement */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚡</span>
              <div>
                <div className="text-amber-400 font-medium text-sm mb-1">
                  Try this next time
                </div>
                <p className="text-white text-sm">{evaluation.improvement}</p>
              </div>
            </div>
          </div>

          {/* Corrected Sentence */}
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">📝</span>
              <div>
                <div className="text-cyan-400 font-medium text-sm mb-1">
                  Better way to say it
                </div>
                <p className="text-white text-sm">{evaluation.correctedSentence}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {/* Primary action FIRST */}
            <button
              onClick={onTryAgain}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-medium transition-colors"
            >
              Try Again
            </button>

          {/* Secondary action */}
            <button
              onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
              >
                Back to Scenarios
            </button>
        </div>
      </div>
    </div>
  );
}

function ErrorState({
  errorMessage: _errorMessage,
  onRetry,
  onClose,
}: Extract<FeedbackCardProps, { state: 'error' }>) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl max-w-lg w-full p-6 md:p-8 border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-1">Couldn&apos;t get your feedback</h2>
        </div>

        {/* Error Panel */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
          <div className="text-amber-400 font-medium text-sm mb-2">
            Something went wrong
          </div>
          <p className="text-white text-sm">
            Your practice session was great — tap below to try getting feedback again.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onRetry}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-medium transition-colors"
          >
            Retry evaluation
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            Skip &amp; go home
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: 'emerald' | 'teal' | 'cyan';
}) {
  const colorClasses = {
    emerald: 'bg-emerald-500',
    teal: 'bg-teal-500',
    cyan: 'bg-cyan-500',
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-xs text-slate-400">{label}</div>
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-500`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <div className="w-8 text-xs text-slate-300 text-right">{score}/10</div>
    </div>
  );
}
