'use client';

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getScenarioById } from '@/config/scenarios';
import {
  ConversationView,
  EvaluationLoading,
  MicButton,
  ReplySuggestions,
  FeedbackCard,
  LevelBadge,
  LevelAdjustBanner,
  StatusStrip,
} from '@/components';
import { useSpeechRecognition, useSpeechSynthesis } from '@/hooks/useSpeech';
import {
  Message,
  ProficiencyLevel,
  Evaluation,
  ConversationMetrics,
  ReplySuggestion,
  ProficiencyAssessment,
} from '@/types';
import { loadSession, saveSession, clearSession } from '@/lib/session-store';

export default function DrillPage() {
  const params = useParams();
  const router = useRouter();
  const scenarioId = params.id as string;
  const scenario = getScenarioById(scenarioId);

  // State
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [];
    return loadSession(scenarioId)?.messages ?? [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [proficiencyLevel, setProficiencyLevel] = useState<ProficiencyLevel>(() => {
    if (typeof window === 'undefined') return scenario?.difficulty ?? 'beginner';
    return loadSession(scenarioId)?.proficiencyLevel ?? scenario?.difficulty ?? 'beginner';
  });
  const [manualOverride, setManualOverride] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return loadSession(scenarioId)?.manualOverride ?? false;
  });
  const [startingLevel] = useState<ProficiencyLevel>(() => {
    if (typeof window === 'undefined') return scenario?.difficulty ?? 'beginner';
    return loadSession(scenarioId)?.startingLevel ?? scenario?.difficulty ?? 'beginner';
  });
  const [levelSuggestion, setLevelSuggestion] = useState<{ to: ProficiencyLevel; rationale: string } | null>(null);
  const [lastAssessedTurnCount, setLastAssessedTurnCount] = useState(0);
  const [speakingStartTime, setSpeakingStartTime] = useState<number | null>(null);
  const [totalSpeakingTime, setTotalSpeakingTime] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return loadSession(scenarioId)?.totalSpeakingTime ?? 0;
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<ReplySuggestion[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [drillEnded, setDrillEnded] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [useTextMode, setUseTextMode] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

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

  const { speak, stop, isSpeaking, usingFallback, error: ttsError } = useSpeechSynthesis();

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


  // Persist session to localStorage on meaningful state changes
  useEffect(() => {
    if (drillEnded || messages.length === 0) return;
    saveSession(scenarioId, {
      messages,
      proficiencyLevel,
      manualOverride,
      turnScores: [],
      totalSpeakingTime,
      startingLevel,
      startedAt: Date.now(),
    });
  }, [messages, proficiencyLevel, manualOverride, totalSpeakingTime, drillEnded, scenarioId, startingLevel]);

  const fetchSuggestions = async () => {
  if (
    !scenario ||
    messages.length === 0 ||
    isListening ||
    isSpeaking ||
    isFetchingSuggestions
  ) return;

  const lastAiMessage = [...messages].reverse().find((m) => m.role === 'ai');
  if (!lastAiMessage) return;

  try {
    setIsFetchingSuggestions(true);

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

    // Prevent flash if user suddenly starts talking
    if (!isListening && !isSpeaking && data.suggestions) {
      setSuggestions(data.suggestions);
      setShowSuggestions(true);
    }
  } catch (error) {
    console.error('Failed to fetch suggestions:', error);
  } finally {
    setIsFetchingSuggestions(false);
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

        // Adaptive difficulty: assess every 4 user turns
        const userTurnCount = messages.filter((m) => m.role === 'user').length + 1;
        if (!manualOverride && userTurnCount % 4 === 0 && userTurnCount > lastAssessedTurnCount) {
          setLastAssessedTurnCount(userTurnCount);
          fetch('/api/assess-level', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              proficiencyLevel,
              conversationHistory: [...messages, userMessage],
            }),
          })
            .then((r) => r.json())
            .then((assessment: ProficiencyAssessment) => {
              if (assessment.recommendedLevel !== proficiencyLevel && assessment.confidence === 'high') {
                setLevelSuggestion({ to: assessment.recommendedLevel, rationale: assessment.rationale });
              }
            })
            .catch(() => {});
        }
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
    setShowSuggestions(false); // Immediate Action: Close the tray
    await sendMessage(text);   // Execute the send
  };

  const fetchEvaluation = async () => {
    if (!scenario || messages.length === 0) return;

    try {
      setEvaluationError(null);
      setEvaluation(null);
      setShowFeedback(false);
      setIsEvaluating(true);

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: scenario.id,
          messages: messages.filter((m) => m.id !== 'initial'),
        }),
      });

      if (!response.ok) {
        throw new Error(`Evaluation failed with status ${response.status}`);
      }

      const data = await response.json();
      setEvaluation(data);
      setShowFeedback(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to evaluate conversation';
      setEvaluationError(errorMessage);
      setShowFeedback(true);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleEndDrill = async () => {
    setDrillEnded(true);
    clearSession(scenarioId);
    await fetchEvaluation();
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
            <div className="flex items-center justify-center gap-2 mt-1">
              <p className="text-xs text-emerald-400">{scenario.aiRole}</p>
              <LevelBadge
                level={proficiencyLevel}
                manualOverride={manualOverride}
                onLevelChange={(l) => {
                  setProficiencyLevel(l);
                  setManualOverride(true);
                  setLevelSuggestion(null);
                }}
                onClearOverride={() => setManualOverride(false)}
              />
            </div>
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
        <ConversationView
          messages={messages}
          isLoading={isLoading}
          isListening={isListening}
          isSpeaking={isSpeaking}
          scenario={scenario}
        />

        <StatusStrip
          isListening={isListening}
          isLoading={isLoading}
          isSpeaking={isSpeaking}
          isEvaluating={isEvaluating}
          usingFallback={usingFallback}
          isFirstMessage={messages.length <= 1}
          onStop={stop}
        />

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

      {/* Level adjustment suggestion */}
      {levelSuggestion && !drillEnded && !isListening && !isSpeaking && (
        <LevelAdjustBanner
          from={proficiencyLevel}
          to={levelSuggestion.to}
          rationale={levelSuggestion.rationale}
          onAccept={() => {
            setProficiencyLevel(levelSuggestion.to);
            setManualOverride(true);
            setLevelSuggestion(null);
          }}
          onDismiss={() => setLevelSuggestion(null)}
        />
      )}

      {/* Suggestions Tray & Manual Trigger */}
      <div className="flex flex-col items-center mb-2">
        {!showSuggestions && !isListening && !isSpeaking && !isLoading && !drillEnded && (
          <button
            onClick={fetchSuggestions}
            disabled={isFetchingSuggestions}
            className="text-[10px] uppercase tracking-wider bg-white/5 border border-white/10 hover:bg-white/10 text-emerald-400 px-3 py-1 rounded-full transition-all flex items-center gap-2 mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="animate-pulse">💡</span>
            {isFetchingSuggestions ? 'Loading...' : 'Need help replying?'}
          </button>
        )}
        
        <ReplySuggestions
          suggestions={suggestions}
          onSelect={handleSuggestionSelect}
          isVisible={showSuggestions && !drillEnded && !isListening && !isSpeaking}
        />
      </div>

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

      {/* Evaluation loading indicator — shown while /api/evaluate request is in flight */}
      <EvaluationLoading isVisible={isEvaluating} />

      {/* Feedback Modal — shown when evaluation completes or errors */}
      {showFeedback && (
        <FeedbackCard
          {...(evaluationError
            ? {
                state: 'error' as const,
                errorMessage: evaluationError,
                onRetry: fetchEvaluation,
                onClose: () => router.push('/'),
              }
            : {
                state: 'success' as const,
                evaluation: evaluation!,
                metrics: metrics,
                proficiencyLevel,
                startingLevel,
                onClose: () => router.push('/'),
                onTryAgain: () => {
                  clearSession(scenarioId);
                  setMessages([]);
                  setEvaluation(null);
                  setEvaluationError(null);
                  setShowFeedback(false);
                  setDrillEnded(false);
                  setTotalSpeakingTime(0);
                  setLevelSuggestion(null);
                  setLastAssessedTurnCount(0);
                },
              })}
        />
      )}
    </div>
  );
}
