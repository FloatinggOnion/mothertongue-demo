'use client';

import { Message } from '@/types';
import { useEffect, useState } from 'react';

interface MessageBubbleProps {
  message: Message;
  showTranslation?: boolean;
  feedbackTurn?: number;
  onReplyFeedback?: (turn: number, answer: 'yes' | 'no', reason?: 'missed_meaning' | 'changed_topic' | 'wrong_language' | 'unnatural' | 'other') => void;
}

export function MessageBubble({
  message,
  showTranslation = false,
  feedbackTurn,
  onReplyFeedback,
}: MessageBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [rated, setRated] = useState(false);
  const [needsReason, setNeedsReason] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setRated(sessionStorage.getItem(`mt:rated:${message.id}`) === '1'), 0);
    return () => window.clearTimeout(timer);
  }, [message.id]);
  const isUser = message.role === 'user';
  // Asides (both the user's question and the tutor's out-of-character
  // answer) render with a muted, dashed, unmistakably-not-roleplay
  // treatment. Roleplay bubbles below are untouched.
  const isAside = message.kind === 'aside-question' || message.kind === 'aside-answer';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 animate-fade-in`}
    >
      <div
        className={`relative max-w-[80%] px-4 py-3 rounded-2xl ${
          isAside
            ? 'bg-[var(--color-paper)] border border-dashed border-[var(--color-text-secondary)]/50 text-[var(--color-text-secondary)]'
            : isUser
              ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-br-sm'
              : 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-divider)] rounded-bl-sm'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isAside && (
          <span className="block font-ui text-[9px] uppercase tracking-[0.2em] text-[var(--color-text-secondary)] mb-1">
            {message.kind === 'aside-answer' ? 'Aside · explanation' : 'Aside'}
          </span>
        )}

        <p className="text-sm md:text-base leading-relaxed font-body">
          {message.content}
        </p>

        {/* Inline translation — fades in on hover. Skipped entirely for asides (aside answers are already plain English). */}
        {!isAside && message.translation && (
          <p
            className={`text-xs mt-2 pt-2 border-t transition-all duration-200 font-ui ${
              isUser
                ? 'border-[var(--color-text-inverse)]/20 text-[var(--color-text-inverse)]/70'
                : 'border-[var(--color-divider)] text-[var(--color-text)]'
            } ${
              isHovered || showTranslation
                ? 'opacity-100 max-h-20'
                : 'opacity-0 max-h-0 overflow-hidden border-transparent'
            }`}
          >
            {message.translation}
          </p>
        )}
        {feedbackTurn !== undefined && onReplyFeedback && process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true' && !rated && (
          <div className="border-t border-divider mt-3 pt-3">
            <p className="font-ui text-[10px] text-text-secondary mb-2">Did your partner understand what you meant?</p>
            {needsReason ? (
              <div className="flex flex-wrap gap-2">
                {([
                  ['missed_meaning', 'Missed my meaning'],
                  ['changed_topic', 'Changed topic'],
                  ['wrong_language', 'Wrong language'],
                  ['unnatural', 'Unnatural wording'],
                  ['other', 'Other'],
                ] as const).map(([reason, label]) => (
                  <button type="button" key={reason} onClick={() => { onReplyFeedback(feedbackTurn, 'no', reason); sessionStorage.setItem(`mt:rated:${message.id}`, '1'); setRated(true); }} className="font-ui text-[10px] border border-divider px-2 py-1 text-text-secondary hover:text-accent">{label}</button>
                ))}
                <button type="button" onClick={() => { onReplyFeedback(feedbackTurn, 'no'); sessionStorage.setItem(`mt:rated:${message.id}`, '1'); setRated(true); }} className="font-ui text-[10px] text-text-secondary underline">Skip reason</button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button type="button" onClick={() => { onReplyFeedback(feedbackTurn, 'yes'); sessionStorage.setItem(`mt:rated:${message.id}`, '1'); setRated(true); }} className="font-ui text-[10px] text-accent underline">Yes</button>
                <button type="button" onClick={() => setNeedsReason(true)} className="font-ui text-[10px] text-accent underline">No</button>
                <button type="button" onClick={() => { sessionStorage.setItem(`mt:rated:${message.id}`, '1'); setRated(true); }} className="font-ui text-[10px] text-text-secondary underline">Skip</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConversationViewProps {
  messages: Message[];
  isLoading?: boolean;
  isWarmingUp?: boolean;
  isListening?: boolean;
  isSpeaking?: boolean;
  scenario?: {
    context: string;
    aiRole: string;
    aiRoleYoruba: string;
    icon: string;
    language: 'yoruba' | 'hausa' | 'igbo';
  };
  onReplyFeedback?: MessageBubbleProps['onReplyFeedback'];
}

export function ConversationView({
  messages,
  isLoading = false,
  isWarmingUp = false,
  isListening = false,
  isSpeaking = false,
  scenario,
  onReplyFeedback,
}: ConversationViewProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 space-y-4">
      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 border border-[var(--color-divider)] bg-[var(--color-surface)]">
            <span className="font-display text-2xl text-[var(--color-accent)]">
              {scenario?.icon ?? '🎤'}
            </span>
          </div>
          <h3 className="font-display text-[var(--color-text)] text-xl mb-2">
            Ready to practise?
          </h3>
          {scenario && (
            <p className="font-body text-[var(--color-text-secondary)] text-sm max-w-[320px] mx-auto mt-2 leading-relaxed">
              {scenario.context} — you&apos;re speaking with{' '}
              <span className="text-[var(--color-accent)]" title={scenario.aiRoleYoruba}>
                {scenario.aiRole}
              </span>.
            </p>
          )}
          <p className="font-ui text-[var(--color-text-secondary)] text-xs mt-4 uppercase tracking-widest">
            Hold the mic to speak · tap Text to type
          </p>
        </div>
      )}

      {messages.map((message, index) => {
        const learnerTurnCount = messages.slice(0, index).filter((item) => item.role === 'user' && (!item.kind || item.kind === 'roleplay')).length;
        const feedbackTurn = message.role === 'ai' && (!message.kind || message.kind === 'roleplay') && learnerTurnCount > 0 && (learnerTurnCount === 1 || learnerTurnCount % 3 === 0)
          ? learnerTurnCount
          : undefined;
        return <MessageBubble key={message.id} message={message} feedbackTurn={feedbackTurn} onReplyFeedback={onReplyFeedback} />;
      })}

      {/* Listening Indicator */}
      {isListening && (
        <div className="flex justify-end mb-4">
          <div className="bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-[var(--color-accent)] text-xs px-4 py-2 rounded-2xl font-ui uppercase tracking-widest">
            Listening...
          </div>
        </div>
      )}

      {/* Speaking Indicator */}
      {isSpeaking && (
        <div className="flex justify-start mb-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-divider)] text-[var(--color-text-secondary)] text-xs px-4 py-2 rounded-2xl animate-pulse font-ui uppercase tracking-widest">
            Speaking...
          </div>
        </div>
      )}

      {/* Loading indicator — upgrades to warm-up message after 5 s */}
      {isLoading && (
        <div className="flex justify-start mb-4">
          <div className="bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-divider)] rounded-2xl rounded-bl-sm px-4 py-3">
            {isWarmingUp ? (
              <div className="animate-pulse">
                <p className="font-ui text-[10px] uppercase tracking-widest text-[var(--color-text-secondary)] mb-1">
                  Warming up model
                </p>
                <p className="font-ui text-xs text-[var(--color-text-secondary)]">
                  First response takes ~20 s — hang tight
                </p>
              </div>
            ) : (
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-[var(--color-accent)] rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-[var(--color-accent)] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-[var(--color-accent)] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Idle hint */}
      {!isLoading && !isListening && !isSpeaking && messages.length > 0 && (
        <div className="text-center font-ui text-[10px] text-[var(--color-text-secondary)] mt-2 uppercase tracking-widest">
          Tap the mic or type to continue...
        </div>
      )}
    </div>
  );
}
