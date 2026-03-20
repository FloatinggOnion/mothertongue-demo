'use client';

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getScenarioById } from '@/config/scenarios';
import {
  ConversationView,
  MicButton,
  ReplySuggestions,
  FeedbackCard,
} from '@/components';
import { useSpeechRecognition, useSpeechSynthesis } from '@/hooks/useSpeech';
import {
  Message,
  ProficiencyLevel,
  Evaluation,
  ConversationMetrics,
  ReplySuggestion,
} from '@/types';

export default function DrillPage() {
  const params = useParams();
  const router = useRouter();
  const scenarioId = params.id as string;
  const scenario = getScenarioById(scenarioId);

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [proficiencyLevel] = useState<ProficiencyLevel>('beginner');
  const [speakingStartTime, setSpeakingStartTime] = useState<number | null>(null);
  const [totalSpeakingTime, setTotalSpeakingTime] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<ReplySuggestion[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [drillEnded, setDrillEnded] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [useTextMode, setUseTextMode] = useState(false);

  // Refs
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  // Speech hooks
  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: sttSupported,
    error: sttError,
  } = useSpeechRecognition();

  const { speak, isSpeaking } = useSpeechSynthesis();

  // Add initial AI message when scenario loads
  useEffect(() => {
    if (scenario && messages.length === 0) {
      const initialMessage: Message = {
        id: crypto.randomUUID(),
        role: 'ai',
        content: scenario.starterPrompt,
        timestamp: Date.now(),
      };
      setMessages([initialMessage]);

      // Speak the initial message
      setTimeout(() => {
        speak(scenario.starterPrompt, scenario.gender);
      }, 500);
    }
  }, [scenario, messages.length, speak]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages]);

  // Silence timer for suggestions
  useEffect(() => {
    if (!isListening && !isSpeaking && !isLoading && messages.length > 0 && !drillEnded) {
      silenceTimerRef.current = setTimeout(() => {
        fetchSuggestions();
      }, 10000); // Show suggestions after 10 seconds of silence
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [isListening, isSpeaking, isLoading, messages, drillEnded]);

  const fetchSuggestions = async () => {
    if (!scenario || messages.length === 0) return;

    const lastAiMessage = [...messages].reverse().find((m) => m.role === 'ai');
    if (!lastAiMessage) return;

    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: scenario.id,
          proficiencyLevel,
          conversationHistory: messages,
          lastAiMessage: lastAiMessage.content,
        }),
      });

      const data = await response.json();
      if (data.suggestions) {
        setSuggestions(data.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  };

  // Send message to AI
  const sendMessage = async (userText: string) => {
    if (!userText.trim() || !scenario) return;

    setShowSuggestions(false);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: scenario.id,
          proficiencyLevel,
          conversationHistory: [...messages, userMessage],
          userMessage: userText.trim(),
        }),
      });

      const data = await response.json();

      if (data.reply) {
        const aiMessage: Message = {
          id: crypto.randomUUID(),
          role: 'ai',
          content: data.reply,
          translation: data.translation,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        speak(data.reply, scenario.gender);
      } else if (data.error) {
        console.error('API error:', data.error);
      }
    } catch (error) {
      console.error('Failed to get AI response:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicPress = useCallback(() => {
    setShowSuggestions(false);
    setSpeakingStartTime(Date.now());
    startListening();
  }, [startListening]);

  const handleMicRelease = useCallback(async () => {
    stopListening();

    // Calculate speaking time
    if (speakingStartTime) {
      const duration = (Date.now() - speakingStartTime) / 1000;
      setTotalSpeakingTime((prev) => prev + duration);
      setSpeakingStartTime(null);
    }

    // Wait a bit for final transcript
    await new Promise((resolve) => setTimeout(resolve, 300));

    const userText = transcript.trim();
    resetTranscript();

    if (userText) {
      await sendMessage(userText);
    }
  }, [stopListening, speakingStartTime, transcript, resetTranscript, sendMessage]);

  const handleTextSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const text = textInput;
    setTextInput('');
    await sendMessage(text);
  };

  const handleSuggestionSelect = async (text: string) => {
    await sendMessage(text);
  };

  const handleEndDrill = async () => {
    setDrillEnded(true);
    setIsLoading(true);

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: scenario?.id,
          messages,
        }),
      });

      const data = await response.json();
      setEvaluation(data);
      setShowFeedback(true);
    } catch (error) {
      console.error('Failed to evaluate:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const metrics: ConversationMetrics = {
    speakingTimeSeconds: totalSpeakingTime,
    turnCount: messages.filter((m) => m.role === 'user').length,
    meaningUnderstoodRate: 0.9,
    userUtterances: messages.filter((m) => m.role === 'user').length,
    aiUtterances: messages.filter((m) => m.role === 'ai').length,
  };

  if (!scenario) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center">
        <div className="text-white text-center">
          <p className="text-xl mb-4">Scenario not found</p>
          <button
            onClick={() => router.push('/')}
            className="text-emerald-400 hover:underline"
          >
            ← Back to scenarios
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-lg border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <div className="text-center">
            <div className="flex items-center gap-2 justify-center">
              <span className="text-xl">{scenario.icon}</span>
              <h1 className="text-white font-semibold">{scenario.title}</h1>
            </div>
            <p className="text-xs text-emerald-400">{scenario.aiRole}</p>
          </div>

          <button
            onClick={handleEndDrill}
            disabled={messages.length < 2 || drillEnded}
            className="text-sm px-3 py-1 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            End Drill
          </button>
        </div>
      </header>

      {/* Conversation */}
      <div
        ref={conversationRef}
        className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full"
      >
        <ConversationView messages={messages} isLoading={isLoading} />

        {/* Live transcript */}
        {(transcript || interimTranscript) && (
          <div className="px-4 mb-4">
            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl px-4 py-2 text-white text-sm">
              <span className="text-emerald-400 text-xs block mb-1">
                You&apos;re saying:
              </span>
              {transcript}
              <span className="text-emerald-300/60">{interimTranscript}</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <ReplySuggestions
        suggestions={suggestions}
        onSelect={handleSuggestionSelect}
        isVisible={showSuggestions && !drillEnded}
      />

      {/* Input Area */}
      <div className="sticky bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pt-6 pb-6">
        <div className="max-w-2xl mx-auto px-4">
          {/* Mode toggle */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setUseTextMode(false)}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  !useTextMode
                    ? 'bg-emerald-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🎙️ Voice
              </button>
              <button
                onClick={() => setUseTextMode(true)}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  useTextMode
                    ? 'bg-emerald-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⌨️ Text
              </button>
            </div>
          </div>

          {useTextMode ? (
            /* Text input mode */
            <form onSubmit={handleTextSubmit} className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your response in Yoruba or English..."
                disabled={isLoading || drillEnded}
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!textInput.trim() || isLoading || drillEnded}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '...' : 'Send'}
              </button>
            </form>
          ) : (
            /* Voice input mode */
            <div className="flex justify-center">
              {!sttSupported || sttError ? (
                <div className="text-center">
                  <p className="text-amber-400 text-sm mb-2">
                    {sttError || 'Speech recognition not available'}
                  </p>
                  <button
                    onClick={() => setUseTextMode(true)}
                    className="text-emerald-400 text-sm hover:underline"
                  >
                    Switch to text input →
                  </button>
                </div>
              ) : (
                <MicButton
                  isListening={isListening}
                  isSpeaking={isSpeaking}
                  isLoading={isLoading}
                  onPress={handleMicPress}
                  onRelease={handleMicRelease}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedback && evaluation && (
        <FeedbackCard
          evaluation={evaluation}
          metrics={metrics}
          onClose={() => router.push('/')}
          onTryAgain={() => {
            setMessages([]);
            setEvaluation(null);
            setShowFeedback(false);
            setDrillEnded(false);
            setTotalSpeakingTime(0);
          }}
        />
      )}
    </div>
  );
}
