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
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`}
    >
      <div
        className={`relative max-w-[80%] px-4 py-3 rounded-2xl ${
          isUser
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-br-sm'
            : 'bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-bl-sm'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <p className="text-sm md:text-base leading-relaxed">{message.content}</p>

        {/* Translation tooltip on hover */}
        {message.translation && (isHovered || showTranslation) && (
          <div
            className={`absolute ${isUser ? 'right-0' : 'left-0'} top-full mt-2 z-10`}
          >
            <div className="bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-lg shadow-lg border border-slate-700 max-w-xs">
              <span className="text-emerald-400 font-medium">Translation: </span>
              {message.translation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ConversationViewProps {
  messages: Message[];
  isLoading?: boolean;
}

export function ConversationView({
  messages,
  isLoading = false,
}: ConversationViewProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isLoading && (
        <div className="flex justify-start mb-4">
          <div className="bg-white/10 backdrop-blur-sm text-white border border-white/20 rounded-2xl rounded-bl-sm px-4 py-3">
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
              <div
                className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                style={{ animationDelay: '0.1s' }}
              />
              <div
                className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
                style={{ animationDelay: '0.2s' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
