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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 
    animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both`}
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
  isListening?: boolean;   // NEW
  isSpeaking?: boolean;    // NEW
}

export function ConversationView({
  messages,
  isLoading = false,
  isListening = false,
  isSpeaking = false,
}: ConversationViewProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 space-y-4">
  {/* --- CENTERED EMPTY STATE --- */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 opacity-50 text-center animate-in fade-in zoom-in-95 duration-1000">
            <div className="bg-emerald-500/10 w-20 h-20 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
              <span className="text-4xl">🎤</span>
            </div>
            <h3 className="text-white font-semibold text-xl tracking-tight">Ready for your Drill?</h3>
            <p className="text-slate-400 text-sm max-w-[280px] mx-auto mt-3 leading-relaxed">
              The AI is preparing your scenario. Listen for the greeting or start speaking in Yoruba.
            </p>
          </div>
        )}

  {messages.map((message) => (
    <MessageBubble key={message.id} message={message} />
  ))}
      {/* 🎙️ Listening Indicator */}
        {isListening && (
          <div className="flex justify-end mb-4">
            <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2 rounded-2xl">
              🎙️ Listening...
            </div>
          </div>
        )}

      {/* 🔊 Speaking Indicator */}
        {isSpeaking && (
          <div className="flex justify-start mb-4">
            <div className="bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs px-4 py-2 rounded-2xl animate-pulse">
              🔊 Speaking...
            </div>
          </div>
        )}
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

      {/* 💡 Idle Hint */}
        {!isLoading && !isListening && !isSpeaking && messages.length > 0 && (
          <div className="text-center text-[10px] text-slate-500 mt-2 animate-pulse">
            Tap the mic or type to continue…
          </div>
        )}
    </div>
  );
}
