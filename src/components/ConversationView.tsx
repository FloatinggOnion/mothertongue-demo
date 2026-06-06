'use client';

import { Message } from '@/types';
import { useState } from 'react';

interface MessageBubbleProps {
  message: Message;
  showTranslation?: boolean;
}

export function MessageBubble({
  message,
  showTranslation = false,
}: MessageBubbleProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 animate-fade-in`}
    >
      <div
        className={`relative max-w-[80%] px-4 py-3 rounded-2xl ${
          isUser
            ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-br-sm'
            : 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-divider)] rounded-bl-sm'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <p className="text-sm md:text-base leading-relaxed font-body">
          {message.content}
        </p>

        {/* Inline translation — fades in on hover */}
        {message.translation && (
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
      </div>
    </div>
  );
}

interface ConversationViewProps {
  messages: Message[];
  isLoading?: boolean;
  isListening?: boolean;
  isSpeaking?: boolean;
  scenario?: { 
    context: string; 
    aiRole: string; 
    aiRoleYoruba: string; 
    icon: string;
    language: 'yoruba' | 'hausa';
  };
}

export function ConversationView({
  messages,
  isLoading = false,
  isListening = false,
  isSpeaking = false,
  scenario,
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

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

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

      {/* Loading dots */}
      {isLoading && (
        <div className="flex justify-start mb-4">
          <div className="bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-divider)] rounded-2xl rounded-bl-sm px-4 py-3">
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-[var(--color-accent)] rounded-full animate-bounce" />
              <div
                className="w-2 h-2 bg-[var(--color-accent)] rounded-full animate-bounce"
                style={{ animationDelay: '0.1s' }}
              />
              <div
                className="w-2 h-2 bg-[var(--color-accent)] rounded-full animate-bounce"
                style={{ animationDelay: '0.2s' }}
              />
            </div>
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