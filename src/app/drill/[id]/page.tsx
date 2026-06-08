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

/* Hallmark · genre: editorial · macrostructure: Editorial Split · design-system: design.md */

export default function DrillPage() {
  const params = useParams();
  const router = useRouter();
  const scenarioId = params.id as string;
  const scenario = getScenarioById(scenarioId);

  // Normalize active language selection
  const isHausa = scenario?.language === 'hausa';

  // State
  const [messages, setMessages] = useState<Message[]>([]);
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
  const conversationRef = useRef<HTMLDivElement>(null);
  const transcriptReadyResolveRef = useRef<((text: string) => void) | null>(null);
  const processingStartedRef = useRef(false);

  // Speech hooks (Passing dynamic BCP-47 locale config directly to initialization)
  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: sttSupported,
    error: sttError,
  } = useSpeechRecognition({
    lang: scenario?.language === 'hausa' ? 'ha-NG' : 'yo-NG'
  });

  const { speak, stop, isSpeaking, usingFallback } = useSpeechSynthesis({
    lang: scenario?.language === 'hausa' ? 'ha-NG' : 'yo-NG'
  });

  useEffect(() => {
    const saved = loadSession(scenarioId)?.messages;
    if (saved) setMessages(saved);
  }, [scenarioId]);

  // Watch interimTranscript to detect when STT server-side transcription completes.
  useEffect(() => {
    if (interimTranscript === 'Processing audio...') {
      processingStartedRef.current = true;
    } else if (interimTranscript === '' && processingStartedRef.current) {
      processingStartedRef.current = false;
      if (transcriptReadyResolveRef.current) {
        transcriptReadyResolveRef.current(transcript);
        transcriptReadyResolveRef.current = null;
      }
    }
  }, [interimTranscript, transcript]);

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
      speak(scenario.starterPrompt, scenario.gender);
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
          language: scenario.language,
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
          language: scenario.language,
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
              language: scenario.language,
            }),
          })
            .then((r) => r.json())
            .then((assessment: ProficiencyAssessment) => {
              if (assessment.recommendedLevel !== proficiencyLevel && assessment.confidence === 'high') {
                setLevelSuggestion({ to: assessment.recommendedLevel, rationale: assessment.rationale });
              }
            })
            .catch(() => { });
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
    
    // Call parameterless function safely since hook is configured on creation
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

    const userText = await new Promise<string>((resolve) => {
      transcriptReadyResolveRef.current = resolve;
      // Safety timeout
      setTimeout(() => {
        if (transcriptReadyResolveRef.current === resolve) {
          transcriptReadyResolveRef.current = null;
          resolve('');
        }
      }, 10000);
    });

    resetTranscript();

    if (userText.trim()) {
      await sendMessage(userText.trim());
    }
  }, [stopListening, speakingStartTime, resetTranscript, sendMessage]);

  const handleTextSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const text = textInput;
    setTextInput('');
    await sendMessage(text);
  };

  const handleSuggestionSelect = async (text: string) => {
    setShowSuggestions(false);
    await sendMessage(text);
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
          language: scenario.language,
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
      <div className="min-h-screen bg-paper flex items-center justify-center selection:bg-accent/30">
        <div className="text-dark text-center">
          <p className="font-display text-xl mb-4">Scenario not found</p>
          <button
            onClick={() => router.push('/')}
            className="font-ui text-sm text-accent hover:underline"
          >
            ← Back to scenarios
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen bg-paper flex flex-col md:flex-row selection:bg-accent/30">
      <img src="/native.jpg" alt="" aria-hidden="true" className="fixed top-[-5%] right-[-5%] w-[400px] opacity-[0.08] rotate-[15deg] pointer-events-none z-0" />
      <img src="/native.jpg" alt="" aria-hidden="true" className="fixed bottom-[10%] left-[-10%] w-[350px] opacity-[0.06] rotate-[-10deg] pointer-events-none z-0" />

      {/* Left Rail (Desktop) */}
      <aside className="hidden md:flex w-[120px] lg:w-[140px] flex-col items-center py-12 border-r border-divider sticky top-0 h-screen shrink-0 z-20 bg-paper/50 backdrop-blur-sm">
        <button
          onClick={() => router.push(`/scenarios?lang=${scenario.language}`)}
          className="group mb-12 hover:translate-x-[-2px] transition-transform duration-base"
        >
          <svg className="w-6 h-6 text-text-secondary group-hover:text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex flex-col items-center gap-4 text-center px-4">
          <span className="font-display text-xl tracking-tight text-dark leading-tight">{scenario.title}</span>
          <div className="h-px w-8 bg-divider" />
          <span className="font-ui text-[9px] uppercase tracking-[0.2em] text-text-secondary leading-tight">{scenario.aiRole}</span>
        </div>

        <div className="mt-auto">
          <div className="w-8 h-8 rounded-full bg-accent animate-pulse-ring" />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col min-w-0 relative z-10">

        {/* Header */}
        <header className="sticky top-0 z-30 bg-paper/80 backdrop-blur-lg border-b border-divider px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/scenarios?lang=${scenario.language}`)}
                className="md:hidden text-text-secondary hover:text-dark transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="hidden md:block text-lg">{scenario.icon}</span>
                  <h1 className="font-display text-lg text-text leading-none md:hidden">{scenario.title}</h1>
                  <span className="font-ui text-label text-accent uppercase tracking-widest hidden md:block">Session in Progress</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="md:hidden font-ui text-[10px] uppercase tracking-wider text-text-secondary">{scenario.aiRole}</span>
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
            </div>

            <button
              onClick={handleEndDrill}
              disabled={messages.length < 2 || drillEnded}
              className="font-ui text-label uppercase tracking-widest px-4 py-2 bg-[var(--color-dark)] text-[var(--color-text-inverse)] hover:bg-accent transition-colors duration-fast disabled:opacity-50"
            >
              End Drill
            </button>
          </div>
        </header>

        {/* Conversation View */}
        <div
          ref={conversationRef}
          className="flex-1 overflow-y-auto w-full pt-12 pb-24 scroll-smooth"
        >
          <div className="max-w-2xl mx-auto w-full px-6">
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
              <div className="mt-8 animate-fade-in">
                <div className="bg-surface border-l-2 border-accent px-6 py-4">
                  <span className="font-ui text-[10px] uppercase tracking-widest text-accent block mb-2 font-semibold">
                    Current Utterance
                  </span>
                  <p className="font-body text-text leading-prose">
                    {transcript}
                    <span className="text-text-secondary opacity-60 italic">{interimTranscript}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Interaction Surface */}
        <div className="sticky bottom-0 bg-paper/95 backdrop-blur-md border-t border-divider pt-6 pb-8 md:pb-12">
          <div className="max-w-2xl mx-auto px-6">

            {/* Level adjustment suggestion */}
            {levelSuggestion && !drillEnded && !isListening && !isSpeaking && (
              <div className="mb-6">
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
              </div>
            )}

            {/* Suggestions Tray */}
            <div className="flex flex-col items-center mb-6">
              {!showSuggestions && !isListening && !isSpeaking && !isLoading && !drillEnded && (
                <button
                  onClick={fetchSuggestions}
                  disabled={isFetchingSuggestions}
                  className="group font-ui text-[10px] uppercase tracking-[0.2em] text-accent hover:text-dark transition-colors flex items-center gap-3 disabled:opacity-50"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-accent group-hover:scale-125 transition-transform" />
                  {isFetchingSuggestions ? 'Fetching Guidance...' : 'Stuck? See suggestions'}
                </button>
              )}

              <ReplySuggestions
                suggestions={suggestions}
                onSelect={handleSuggestionSelect}
                isVisible={showSuggestions && !drillEnded && !isListening && !isSpeaking}
              />
            </div>

            {/* Mode toggle */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-surface border border-divider rounded-sm p-1">
                <button
                  onClick={() => setUseTextMode(false)}
                  className={`px-6 py-2 font-ui text-[11px] uppercase tracking-widest rounded-sm transition-all duration-base ${!useTextMode
                      ? 'bg-accent text-text-inverse shadow-sm'
                      : 'text-text-secondary hover:text-dark'
                    }`}
                >
                  Voice
                </button>
                <button
                  onClick={() => setUseTextMode(true)}
                  className={`px-6 py-2 font-ui text-[11px] uppercase tracking-widest rounded-sm transition-all duration-base ${useTextMode
                      ? 'bg-accent text-text-inverse shadow-sm'
                      : 'text-text-secondary hover:text-dark'
                    }`}
                >
                  Text
                </button>
              </div>
            </div>

            {/* Input Controls */}
            {useTextMode ? (
              <form onSubmit={handleTextSubmit} className="flex gap-4">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={isHausa ? "Respond in Hausa or English..." : "Respond in Yoruba or English..."}
                  disabled={isLoading || drillEnded}
                  className="flex-1 bg-white border border-divider rounded-sm px-6 py-4 font-body text-text placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isLoading || drillEnded}
                  className="px-8 bg-dark text-text-inverse font-ui text-label uppercase tracking-widest hover:bg-accent transition-colors duration-fast disabled:opacity-30"
                >
                  {isLoading ? '...' : 'Send'}
                </button>
              </form>
            ) : (
              <div className="flex justify-center">
                {!sttSupported || sttError === 'Microphone access denied' || sttError === 'Microphone unavailable' ? (
                  <div className="text-center">
                    <p className="font-ui text-xs text-accent-warm mb-3">
                      {sttError || 'Speech recognition not available in this environment'}
                    </p>
                    <button
                      onClick={() => setUseTextMode(true)}
                      className="font-ui text-[11px] uppercase tracking-widest text-dark hover:text-accent underline underline-offset-4"
                    >
                      Switch to text input
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    {sttError && (
                      <p className="font-ui text-[10px] uppercase tracking-widest text-accent-warm">Transcription failed • Try again</p>
                    )}
                    <MicButton
                      isListening={isListening}
                      isSpeaking={isSpeaking}
                      isLoading={isLoading}
                      onPress={handleMicPress}
                      onRelease={handleMicRelease}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modals & Overlays */}
        <EvaluationLoading isVisible={isEvaluating} />

        {showFeedback && (
          <FeedbackCard
            {...(evaluationError
              ? {
                state: 'error' as const,
                errorMessage: evaluationError,
                onRetry: fetchEvaluation,
                onClose: () => router.push(`/scenarios?lang=${scenario.language}`),
              }
              : {
                state: 'success' as const,
                evaluation: evaluation!,
                metrics: metrics,
                proficiencyLevel,
                startingLevel,
                onClose: () => router.push(`/scenarios?lang=${scenario.language}`),
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
    </main>
  );
}