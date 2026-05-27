'use client';

import { Evaluation, ConversationMetrics, ProficiencyLevel } from '@/types';

/* Hallmark · component: FeedbackCard · genre: editorial · theme: custom (Mother Tongue)
 * states: success · error
 */

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
    <div className="fixed inset-0 bg-dark-alt/70 backdrop-blur-sm flex items-center justify-center z-modal p-4 animate-fade-in overflow-y-auto">
      <div className="bg-paper rounded-lg max-w-lg w-full p-6 md:p-8 border border-divider shadow-xl my-4 text-center">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="font-display text-4xl text-accent mb-2">✅</div>
          <h2 className="font-display text-2xl text-dark mb-1">Drill Complete!</h2>
          <p className="font-body text-text-secondary text-sm">Here&apos;s how you did</p>
          {proficiencyLevel && (
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              <span className="font-ui text-label text-text-secondary uppercase tracking-widest">Finished at</span>
              <span className="font-ui text-caption font-medium text-accent bg-accent/10 border border-accent/30 px-3 py-1 rounded-full">
                {LEVEL_LABELS[proficiencyLevel]}
              </span>
              {levelChanged && (
                <span className={`font-ui text-caption font-medium px-3 py-1 rounded-full ${
                  leveledUp
                    ? 'text-accent-warm bg-accent-warm/10 border border-accent-warm/30'
                    : 'text-accent-cool bg-accent-cool/10 border border-accent-cool/30'
                }`}>
                  {leveledUp ? '↑ Leveled Up' : '↓ Adjusted'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Hero score */}
        <div className="flex flex-col items-center mb-8">
          <div className="font-display text-hero text-dark leading-none">
            {evaluation.overallScore}<span className="font-body text-2xl text-text-secondary/70">/10</span>
          </div>
          <p className="font-ui text-caption text-text-secondary mt-2">{scoreLabel}</p>
        </div>

        {/* Sub-scores */}
        <div className="mb-8 space-y-4 max-w-sm mx-auto">
          <ScoreBar label="Fluency" score={evaluation.fluencyScore} color="accent" />
          <ScoreBar label="Grammar" score={evaluation.grammarScore} color="accent-cool" />
          <ScoreBar label="Confidence" score={evaluation.confidenceScore} color="accent-warm" />
        </div>

        {/* Session stats */}
        <div className="grid grid-cols-2 gap-4 mb-8 max-w-sm mx-auto">
          <div className="bg-surface rounded-sm p-4 text-center border border-divider">
            <div className="font-display text-2xl text-dark leading-none">{formatTime(metrics.speakingTimeSeconds)}</div>
            <div className="font-ui text-caption text-text-secondary mt-1">Speaking Time</div>
          </div>
          <div className="bg-surface rounded-sm p-4 text-center border border-divider">
            <div className="font-display text-2xl text-dark leading-none">{metrics.turnCount}</div>
            <div className="font-ui text-caption text-text-secondary mt-1">Turns</div>
          </div>
        </div>

        {/* Feedback */}
        <div className="space-y-6 mb-8 text-left">
          {/* Strength */}
          <div className="bg-surface border border-accent/40 rounded-sm p-5">
            <div className="flex items-start gap-4">
              <span className="font-display text-xl text-accent shrink-0">✓</span>
              <div>
                <div className="font-ui text-label text-accent font-medium mb-1 uppercase tracking-wider">
                  What you did well
                </div>
                <p className="font-body text-text text-sm leading-prose">{evaluation.strength}</p>
                {evaluation.strengthExample && (
                  <p className="font-body text-accent/80 text-xs mt-2 italic">
                    &quot;{evaluation.strengthExample}&quot;
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Improvement */}
          <div className="bg-surface border border-accent-warm/40 rounded-sm p-5">
            <div className="flex items-start gap-4">
              <span className="font-display text-xl text-accent-warm shrink-0">⚡</span>
              <div>
                <div className="font-ui text-label text-accent-warm font-medium mb-1 uppercase tracking-wider">
                  Try this next time
                </div>
                <p className="font-body text-text text-sm leading-prose">{evaluation.improvement}</p>
              </div>
            </div>
          </div>

          {/* Corrected Sentence */}
          <div className="bg-surface border border-accent-cool/40 rounded-sm p-5">
            <div className="flex items-start gap-4">
              <span className="font-display text-xl text-accent-cool shrink-0">📝</span>
              <div>
                <div className="font-ui text-label text-accent-cool font-medium mb-1 uppercase tracking-wider">
                  Better way to say it
                </div>
                <p className="font-body text-text text-sm leading-prose">{evaluation.correctedSentence}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onTryAgain}
            className="flex-1 py-3 px-4 rounded-sm bg-accent text-text-inverse font-ui text-caption uppercase tracking-widest hover:bg-[#A84E22] transition-colors duration-fast ease-out"
          >
            Try Again
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-sm bg-dark text-text-inverse font-ui text-caption uppercase tracking-widest hover:bg-accent/80 transition-colors duration-fast ease-out"
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
    <div className="fixed inset-0 bg-dark-alt/70 backdrop-blur-sm flex items-center justify-center z-modal p-4 animate-fade-in">
      <div className="bg-paper rounded-lg max-w-lg w-full p-6 md:p-8 border border-divider shadow-xl my-4 text-center">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="font-display text-4xl text-accent-warm mb-2">⚠️</div>
          <h2 className="font-display text-2xl text-dark mb-1">Couldn&apos;t get your feedback</h2>
        </div>

        {/* Error Panel */}
        <div className="bg-surface border border-accent-warm/40 rounded-sm p-5 mb-8">
          <div className="font-ui text-label text-accent-warm font-medium mb-2 uppercase tracking-wider">
            Something went wrong
          </div>
          <p className="font-body text-text text-sm leading-prose">
            Your practice session was great — tap below to try getting feedback again.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onRetry}
            className="flex-1 py-3 px-4 rounded-sm bg-accent-warm text-text-inverse font-ui text-caption uppercase tracking-widest hover:bg-[#B7733B] transition-colors duration-fast ease-out"
          >
            Retry evaluation
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-sm bg-dark text-text-inverse font-ui text-caption uppercase tracking-widest hover:bg-accent-warm/80 transition-colors duration-fast ease-out"
          >
            Skip &amp; Go Home
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
  color: 'accent' | 'accent-cool' | 'accent-warm';
}) {

  return (
    <div className="flex items-center gap-3">
      <div className="w-20 font-ui text-caption text-text-secondary uppercase tracking-widest">{label}</div>
      <div className="flex-1 h-1.5 bg-divider rounded-full overflow-hidden">
        <div
          className={`h-full bg-${color} transition-all duration-base ease-out`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <div className="w-8 font-ui text-caption text-text-secondary text-right">{score}/10</div>
    </div>
  );
}
