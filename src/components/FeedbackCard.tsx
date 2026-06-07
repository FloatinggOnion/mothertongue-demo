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
    <div className="fixed inset-0 bg-[#1A2744]/70 backdrop-blur-sm flex items-start justify-center z-50 p-4 animate-fade-in overflow-y-auto">
      <div className="bg-[#F5F0E8] rounded-lg max-w-lg w-full p-6 md:p-8 border border-[#D9D2C7] shadow-xl my-8">

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="font-display text-2xl text-[#2C1810] mb-1">Drill Complete</h2>
          <p className="font-body text-[#A89B8C] text-sm">Here&apos;s how you did</p>
          {proficiencyLevel && (
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              <span className="font-ui text-[11px] text-[#A89B8C] uppercase tracking-widest">Finished at</span>
              <span className="font-ui text-[11px] font-medium text-[#C4622D] bg-[#C4622D]/10 border border-[#C4622D]/30 px-3 py-1 rounded-full">
                {LEVEL_LABELS[proficiencyLevel]}
              </span>
              {levelChanged && (
                <span className={`font-ui text-[11px] font-medium px-3 py-1 rounded-full ${
                  leveledUp
                    ? 'text-[#E8955A] bg-[#E8955A]/10 border border-[#E8955A]/30'
                    : 'text-[#2D5A4E] bg-[#2D5A4E]/10 border border-[#2D5A4E]/30'
                }`}>
                  {leveledUp ? '↑ Leveled Up' : '↓ Adjusted'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Hero score */}
        <div className="flex flex-col items-center mb-8">
          <div className="font-display text-[3rem] text-[#2C1810] leading-none">
            {evaluation.overallScore}<span className="font-body text-2xl text-[#A89B8C]">/10</span>
          </div>
          <p className="font-ui text-[11px] text-[#A89B8C] mt-2 uppercase tracking-widest">{scoreLabel}</p>
        </div>

        {/* Sub-scores */}
        <div className="mb-8 space-y-4 max-w-sm mx-auto">
          <ScoreBar label="Fluency" score={evaluation.fluencyScore} color="#C4622D" />
          <ScoreBar label="Grammar" score={evaluation.grammarScore} color="#2D5A4E" />
          <ScoreBar label="Confidence" score={evaluation.confidenceScore} color="#E8955A" />
        </div>

        {/* Session stats */}
        <div className="grid grid-cols-2 gap-4 mb-8 max-w-sm mx-auto">
          <div className="bg-[#EDE8DF] rounded-sm p-4 text-center border border-[#D9D2C7]">
            <div className="font-display text-2xl text-[#2C1810] leading-none">{formatTime(metrics.speakingTimeSeconds)}</div>
            <div className="font-ui text-[11px] text-[#A89B8C] mt-1 uppercase tracking-widest">Speaking Time</div>
          </div>
          <div className="bg-[#EDE8DF] rounded-sm p-4 text-center border border-[#D9D2C7]">
            <div className="font-display text-2xl text-[#2C1810] leading-none">{metrics.turnCount}</div>
            <div className="font-ui text-[11px] text-[#A89B8C] mt-1 uppercase tracking-widest">Turns</div>
          </div>
        </div>

        {/* Feedback sections */}
        <div className="space-y-4 mb-8">
          {/* Strength */}
          <div className="bg-[#EDE8DF] border border-[#C4622D]/30 rounded-sm p-5">
            <div className="flex items-start gap-4">
              <span className="font-display text-lg text-[#C4622D] shrink-0 mt-0.5">✓</span>
              <div>
                <div className="font-ui text-[10px] text-[#C4622D] font-medium mb-2 uppercase tracking-wider">
                  What you did well
                </div>
                <p className="font-body text-[#2C1810] text-sm leading-relaxed">{evaluation.strength}</p>
                {evaluation.strengthExample && (
                  <p className="font-body text-[#C4622D]/80 text-xs mt-2 italic">
                    &quot;{evaluation.strengthExample}&quot;
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Improvement */}
          <div className="bg-[#EDE8DF] border border-[#E8955A]/30 rounded-sm p-5">
            <div className="flex items-start gap-4">
              <span className="font-display text-lg text-[#E8955A] shrink-0 mt-0.5">⚡</span>
              <div>
                <div className="font-ui text-[10px] text-[#E8955A] font-medium mb-2 uppercase tracking-wider">
                  Try this next time
                </div>
                <p className="font-body text-[#2C1810] text-sm leading-relaxed">{evaluation.improvement}</p>
              </div>
            </div>
          </div>

          {/* Corrected Sentence */}
          <div className="bg-[#EDE8DF] border border-[#2D5A4E]/30 rounded-sm p-5">
            <div className="flex items-start gap-4">
              <span className="font-display text-lg text-[#2D5A4E] shrink-0 mt-0.5">📝</span>
              <div>
                <div className="font-ui text-[10px] text-[#2D5A4E] font-medium mb-2 uppercase tracking-wider">
                  Better way to say it
                </div>
                <p className="font-body text-[#2C1810] text-sm leading-relaxed">{evaluation.correctedSentence}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onTryAgain}
            className="flex-1 py-3 px-4 rounded-sm bg-[#C4622D] text-[#F5F0E8] font-ui text-[11px] uppercase tracking-widest hover:bg-[#A84E22] transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-sm bg-[#2C1810] text-[#F5F0E8] font-ui text-[11px] uppercase tracking-widest hover:bg-[#C4622D] transition-colors"
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
    <div className="fixed inset-0 bg-[#1A2744]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-[#F5F0E8] rounded-lg max-w-lg w-full p-6 md:p-8 border border-[#D9D2C7] shadow-xl my-4 text-center">
        <div className="text-center mb-6">
          <h2 className="font-display text-2xl text-[#2C1810] mb-1">Couldn&apos;t get your feedback</h2>
        </div>

        <div className="bg-[#EDE8DF] border border-[#E8955A]/40 rounded-sm p-5 mb-8 text-left">
          <div className="font-ui text-[10px] text-[#E8955A] font-medium mb-2 uppercase tracking-wider">
            Something went wrong
          </div>
          <p className="font-body text-[#2C1810] text-sm leading-relaxed">
            Your practice session was great — tap below to try getting feedback again.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onRetry}
            className="flex-1 py-3 px-4 rounded-sm bg-[#E8955A] text-[#F5F0E8] font-ui text-[11px] uppercase tracking-widest hover:bg-[#B7733B] transition-colors"
          >
            Retry evaluation
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-sm bg-[#2C1810] text-[#F5F0E8] font-ui text-[11px] uppercase tracking-widest hover:bg-[#E8955A] transition-colors"
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
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 font-ui text-[10px] text-[#A89B8C] uppercase tracking-widest">{label}</div>
      <div className="flex-1 h-1.5 bg-[#D9D2C7] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${score * 10}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-8 font-ui text-[11px] text-[#A89B8C] text-right">{score}/10</div>
    </div>
  );
}