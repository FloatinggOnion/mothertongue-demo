'use client';

import { Evaluation, ConversationMetrics } from '@/types';

interface FeedbackCardProps {
  evaluation: Evaluation;
  metrics: ConversationMetrics;
  onClose: () => void;
  onTryAgain: () => void;
}

export function FeedbackCard({
  evaluation,
  metrics,
  onClose,
  onTryAgain,
}: FeedbackCardProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl max-w-lg w-full p-6 md:p-8 border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-1">Drill Complete!</h2>
          <p className="text-slate-400 text-sm">
            Here&apos;s how you did in this conversation
          </p>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">
              {formatTime(metrics.speakingTimeSeconds)}
            </div>
            <div className="text-xs text-slate-400">Speaking Time</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-teal-400">
              {metrics.turnCount}
            </div>
            <div className="text-xs text-slate-400">Turns</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-cyan-400">
              {evaluation.overallScore}/10
            </div>
            <div className="text-xs text-slate-400">Score</div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="mb-6 space-y-2">
          <ScoreBar label="Fluency" score={evaluation.fluencyScore} color="emerald" />
          <ScoreBar label="Grammar" score={evaluation.grammarScore} color="teal" />
          <ScoreBar
            label="Confidence"
            score={evaluation.confidenceScore}
            color="cyan"
          />
        </div>

        {/* Feedback */}
        <div className="space-y-4 mb-6">
          {/* Strength */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
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
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          >
            Back to Scenarios
          </button>
          <button
            onClick={onTryAgain}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-medium transition-colors"
          >
            Try Again
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
