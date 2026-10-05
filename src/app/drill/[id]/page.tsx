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
import { roleplayHistory } from '@/lib/conversation';
import { SaveProgressAction } from '@/components/SaveProgressAction';
import { ShareConversationAction } from '@/components/ShareConversationAction';
import { measure } from '@/lib/measurement-client';

/* Hallmark · genre: editorial · macrostructure: Editorial Split · design-system: design.md */

export default function DrillPage() {
  const params = useParams();
  const router = useRouter();
  const scenarioId = params.id as string;
  const scenario = getScenarioById(scenarioId);

  function langBcp47(language?: string) {
    if (language === 'hausa') return 'ha-NG';
    if (language === 'igbo') return 'ig-NG';
    return 'yo-NG';
  }

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
  const [sessionKey, setSessionKey] = useState(() => {
    if (typeof window === 'undefined') return '';
    return loadSession(scenarioId)?.sessionKey ?? crypto.randomUUID();
  });
  const [startedAt, setStartedAt] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return loadSession(scenarioId)?.startedAt ?? Date.now();
  });
  const [levelSuggestion, setLevelSuggestion] = useState<{ to: ProficiencyLevel; rationale: string } | null>(null);
  const [lastAssessedTurnCount, setLastAssessedTurnCount] = useState(0);
  const [speakingStartTime, setSpeakingStartTime] = useState<number | null>(null);
  const [totalSpeakingTime, setTotalSpeakingTime] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return loadSession(scenarioId)?.totalSpeakingTime ?? 0;
  });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hintStep, setHintStep] = useState<1 | 2 | 3>(1);
  const [suggestions, setSuggestions] = useState<ReplySuggestion[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [drillEnded, setDrillEnded] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [useTextMode, setUseTextMode] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [failedTurn, setFailedTurn] = useState<{ id: string; text: string; forceAside: boolean } | null>(null);
  const [asideMode, setAsideMode] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);

  // Refs
  const conversationRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const suggestionRequestRef = useRef(0);
  const replaceMessages = useCallback((next: Message[] | ((previous: Message[]) => Message[])) => {
    const resolved = typeof next === 'function' ? next(messagesRef.current) : next;
    messagesRef.current = resolved;
    setMessages(resolved);
  }, []);
  useEffect(() => {
    if (!scenario || !sessionKey) return;
    const marker = `mt:measured-start:${sessionKey}`;
    if (sessionStorage.getItem(marker)) return;
    sessionStorage.setItem(marker, '1');
    measure({ event: 'scenario_started', sessionId: sessionKey, scenarioId: scenario.id, proficiencyLevel: startingLevel });
  }, [scenario, sessionKey, startingLevel]);
  // Kept in sync so the memoised useSpeechRecognition callback (which
  // closes over stale state) always reads the current armed state.
  const asideModeRef = useRef(asideMode);
  useEffect(() => {
    asideModeRef.current = asideMode;
  }, [asideMode]);

  // Upgrade loading indicator to warm-up message if response takes >5 s
  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => setWarmingUp(true), 5000);
    return () => clearTimeout(t);
  }, [isLoading]);

  const { speak, stop, isSpeaking, usingFallback } = useSpeechSynthesis({
    lang: langBcp47(scenario?.language),
  });

  // Read history before scheduling a React state update. An updater callback
  // may run later, so it cannot be used to capture history for this request.
  const sendMessage = useCallback(async (userText: string, opts?: { forceAside?: boolean; inputMode?: 'text' | 'voice'; retry?: boolean }) => {
    if (!userText.trim() || !scenario) return;

    suggestionRequestRef.current += 1;
    setShowSuggestions(false);
    setHintStep(1);
    setSuggestionError(null);
    setFailedTurn(null);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText.trim(),
      timestamp: Date.now(),
      // Optimistic tag — retagged to 'aside-question' below if the server
      // classifies it as an aside after the fact.
      kind: opts?.forceAside ? 'aside-question' : 'roleplay',
    };

    const previousMessages = messagesRef.current;
    replaceMessages([...previousMessages, userMessage]);
    const currentHistory: Message[] = [...previousMessages, userMessage];
    const turnIndex = roleplayHistory(currentHistory).filter((message) => message.role === 'user').length;
    if (!opts?.retry) measure({ event: 'learner_turn_sent', sessionId: sessionKey, scenarioId: scenario.id, proficiencyLevel, turnIndex, inputMode: opts?.inputMode ?? 'text' });

    setWarmingUp(false);
    setIsLoading(true);
    const requestStartedAt = performance.now();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: scenario.id,
          proficiencyLevel,
          // History as it was BEFORE this turn — sending currentHistory
          // (which already includes userMessage) would double-send the
          // newest turn since it's also passed as userMessage below.
          conversationHistory: roleplayHistory(previousMessages),
          userMessage: userText.trim(),
          language: scenario.language,
          forceAside: opts?.forceAside ?? false,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Your message could not be sent. Please try again.');

      if (data.kind === 'aside') {
        // Classification happened server-side after the optimistic append —
        // retro-tag the user's message and append the tutor's answer.
        replaceMessages((prev) =>
          prev.map((m) => (m.id === userMessage.id ? { ...m, kind: 'aside-question' as const } : m))
        );
        const asideAnswer: Message = {
          id: crypto.randomUUID(),
          role: 'ai',
          content: data.answer,
          kind: 'aside-answer',
          timestamp: Date.now(),
        };
        replaceMessages((prev) => [...prev, asideAnswer]);
        // No speak() — the answer is English tutor prose, not a target-language
        // partner line. No assess-level trigger — asides don't reflect roleplay ability.
      } else if (data.reply) {
        measure({ event: 'partner_reply_succeeded', sessionId: sessionKey, scenarioId: scenario.id, proficiencyLevel, turnIndex, durationMs: Math.min(180000, Math.round(performance.now() - requestStartedAt)) });
        const aiMessage: Message = {
          id: crypto.randomUUID(),
          role: 'ai',
          content: data.reply,
          translation: data.translation,
          timestamp: Date.now(),
          kind: 'roleplay',
        };
        replaceMessages((prev) => [...prev, aiMessage]);
        speak(data.reply, scenario.gender);

        // Adaptive difficulty: assess every 4 user turns, counted from
        // roleplay-only history so asides never advance the cadence.
        const roleplayUpToNow = roleplayHistory([...currentHistory, aiMessage]);
        const userTurnCount = roleplayUpToNow.filter((m) => m.role === 'user').length;
        if (!manualOverride && userTurnCount % 4 === 0 && userTurnCount > lastAssessedTurnCount) {
          setLastAssessedTurnCount(userTurnCount);
          fetch('/api/assess-level', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              proficiencyLevel,
              conversationHistory: roleplayUpToNow,
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
      } else {
        throw new Error(data.error || 'The partner did not answer. Please try again.');
      }
    } catch (error) {
      console.error('Failed to get AI response:', error);
      measure({ event: 'partner_reply_failed', sessionId: sessionKey, scenarioId: scenario.id, proficiencyLevel, turnIndex, durationMs: Math.min(180000, Math.round(performance.now() - requestStartedAt)) });
      setFailedTurn({ id: userMessage.id, text: userText.trim(), forceAside: opts?.forceAside ?? false });
    } finally {
      setIsLoading(false);
      setWarmingUp(false);
      setAsideMode(false);
    }
  }, [scenario, proficiencyLevel, manualOverride, lastAssessedTurnCount, speak, replaceMessages, sessionKey]);

  // Speech recognition hook registered to pipeline transcription text seamlessly
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
    lang: langBcp47(scenario?.language),
    onTranscriptionComplete: (finalizedText) => {
      if (finalizedText.trim()) {
        sendMessage(finalizedText.trim(), { forceAside: asideModeRef.current, inputMode: 'voice' });
        resetTranscript();
      }
    }
  });

  useEffect(() => {
    const saved = loadSession(scenarioId)?.messages;
    if (saved) replaceMessages(saved);
  }, [scenarioId, replaceMessages]);

  // Add initial AI message when scenario loads
  useEffect(() => {
    if (scenario && messagesRef.current.length === 0) {
      const initialMessage: Message = {
        id: crypto.randomUUID(),
        role: 'ai',
        content: scenario.starterPrompt,
        timestamp: Date.now(),
      };
      replaceMessages([initialMessage]);

      // Speak the initial message
      speak(scenario.starterPrompt, scenario.gender);
    }
  }, [scenario, messages.length, speak, replaceMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = messages.some((message) => message.role === 'user')
        ? conversationRef.current.scrollHeight
        : 0;
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
      startedAt,
      sessionKey,
    });
  }, [messages, proficiencyLevel, manualOverride, totalSpeakingTime, drillEnded, scenarioId, startingLevel, startedAt, sessionKey]);

  const fetchSuggestions = async () => {
    if (
      !scenario ||
      messages.length === 0 ||
      isListening ||
      isSpeaking ||
      isFetchingSuggestions
    ) return;
    measure({ event: 'hint_opened', sessionId: sessionKey, scenarioId: scenario.id, proficiencyLevel, turnIndex: roleplayHistory(messages).filter((message) => message.role === 'user').length });

    const roleplayMessages = roleplayHistory(messages);
    const lastAiMessage = [...roleplayMessages].reverse().find((m) => m.role === 'ai');
    if (!lastAiMessage) return;

    const requestId = ++suggestionRequestRef.current;
    try {
      setSuggestionError(null);
      setIsFetchingSuggestions(true);

      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: scenario.id,
          proficiencyLevel,
          conversationHistory: roleplayMessages,
          lastAiMessage: lastAiMessage.content,
          language: scenario.language,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Guidance is unavailable right now. Please try again.');
      if (!Array.isArray(data.suggestions) || data.suggestions.length === 0) {
        throw new Error('No suggestions came back. Please try again.');
      }

      if (requestId === suggestionRequestRef.current && !isListening && !isSpeaking) {
        setSuggestions(data.suggestions);
        setHintStep(1);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      if (requestId === suggestionRequestRef.current && !isListening && !isSpeaking) {
        setSuggestionError(error instanceof Error ? error.message : 'Guidance is unavailable right now. Please try again.');
      }
    } finally {
      setIsFetchingSuggestions(false);
    }
  };

  const handleMicPress = useCallback(() => {
    suggestionRequestRef.current += 1;
    setShowSuggestions(false);
    setHintStep(1);
    setSpeakingStartTime(Date.now());
    startListening();
  }, [startListening]);

  const handleMicRelease = useCallback(() => {
    stopListening();

    if (speakingStartTime) {
      const duration = (Date.now() - speakingStartTime) / 1000;
      setTotalSpeakingTime((prev) => prev + duration);
      setSpeakingStartTime(null);
    }
  }, [stopListening, speakingStartTime]);

  const handleTextSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || failedTurn) return;

    const text = textInput;
    setTextInput('');
    await sendMessage(text, { forceAside: asideMode });
  };

  const handleSuggestionSelect = (text: string) => {
    setShowSuggestions(false);
    setHintStep(1);
    setTextInput(text);
    setUseTextMode(true);
  };

  const retryFailedTurn = () => {
    if (!failedTurn) return;
    replaceMessages((previous) => previous.filter((message) => message.id !== failedTurn.id));
    sendMessage(failedTurn.text, { forceAside: failedTurn.forceAside, retry: true });
  };

  const editFailedTurn = () => {
    if (!failedTurn) return;
    replaceMessages((previous) => previous.filter((message) => message.id !== failedTurn.id));
    setTextInput(failedTurn.text);
    setUseTextMode(true);
    setFailedTurn(null);
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
          messages: roleplayHistory(messages).filter((m) => m.id !== 'initial'),
          language: scenario.language,
          proficiencyLevel, // required by the evaluator rubric
        }),
      });

      if (!response.ok) {
        // Surface the server's message when available (e.g. the "too short" 400)
        const errorBody = await response.json().catch(() => ({}));
        const serverMsg = errorBody?.error;
        throw new Error(serverMsg || `Evaluation failed with status ${response.status}`);
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
    measure({ event: 'session_finished', sessionId: sessionKey, scenarioId, proficiencyLevel, turnIndex: roleplayHistory(messages).filter((message) => message.role === 'user').length });
    setDrillEnded(true);
    if (roleplayHistory(messages).filter((m) => m.role === 'user').length < 2) {
      setShowFeedback(true);
      return;
    }
    await fetchEvaluation();
  };

  const continueDrill = () => {
    setShowFeedback(false);
    setEvaluationError(null);
    setDrillEnded(false);
  };

  const leaveDrill = () => {
    clearSession(scenarioId);
    router.push(`/scenarios?lang=${scenario?.language ?? 'yoruba'}`);
  };

  const roleplayMessages = roleplayHistory(messages);
  const metrics: ConversationMetrics = {
    speakingTimeSeconds: totalSpeakingTime,
    turnCount: roleplayMessages.filter((m) => m.role === 'user').length,
    meaningUnderstoodRate: 0.9,
    userUtterances: roleplayMessages.filter((m) => m.role === 'user').length,
    aiUtterances: roleplayMessages.filter((m) => m.role === 'ai').length,
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
    <main className="relative h-dvh overflow-hidden bg-paper flex flex-col md:flex-row selection:bg-accent/30">
      <img src="/native.jpg" alt="" aria-hidden="true" className="fixed top-[-5%] right-[-5%] w-[400px] opacity-[0.08] rotate-[15deg] pointer-events-none z-0" />
      <img src="/native.jpg" alt="" aria-hidden="true" className="fixed bottom-[10%] left-[-10%] w-[350px] opacity-[0.06] rotate-[-10deg] pointer-events-none z-0" />

      {/* Left Rail (Desktop) */}
      <aside className="hidden md:flex w-[120px] lg:w-[140px] flex-col items-center py-12 border-r border-divider h-dvh shrink-0 z-20 bg-paper/50 backdrop-blur-sm">
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
      <div className="flex-grow flex flex-col min-w-0 min-h-0 relative z-10">

        {/* Header */}
        <header className="shrink-0 z-30 bg-paper/80 backdrop-blur-lg border-b border-divider px-6 py-4">
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
                  <span title={scenario.aiRole} className="md:hidden font-ui text-[10px] uppercase tracking-wider text-text-secondary truncate max-w-[120px]">{scenario.aiRole.split(',')[0]}</span>
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

            <div className="flex items-center gap-2">
            {metrics.turnCount > 0 && !showFeedback && <SaveProgressAction scenarioId={scenarioId} proficiencyLevel={proficiencyLevel} turnCount={metrics.turnCount} sessionKey={sessionKey} />}
            <button
              onClick={handleEndDrill}
              disabled={messages.length < 2 || drillEnded || isLoading || Boolean(failedTurn)}
              className="font-ui text-label uppercase tracking-widest px-4 py-2 bg-[var(--color-dark)] text-[var(--color-text-inverse)] hover:bg-accent transition-colors duration-fast disabled:opacity-50"
            >
              <span className="md:hidden">End</span><span className="hidden md:inline">End Drill</span>
            </button>
            </div>
          </div>
        </header>

        {/* Conversation View */}
        <div
          ref={conversationRef}
          className="flex-1 min-h-0 overflow-y-auto w-full pt-8 pb-8 scroll-smooth"
        >
          <div className="max-w-2xl mx-auto w-full px-6">
            {roleplayHistory(messages).every((message) => message.role !== 'user') && (
              <section aria-label="Getting started" className="mb-8 border-l-2 border-accent bg-surface px-5 py-4">
                <p className="font-ui text-[10px] uppercase tracking-widest text-accent mb-2">Your scene</p>
                <p className="font-body text-sm text-text">{scenario.description}. You are speaking with {scenario.aiRole}.</p>
                <p className="font-body text-sm text-text-secondary mt-2">
                  Answer in {scenario.language.charAt(0).toUpperCase() + scenario.language.slice(1)} or English to begin. If you get stuck, ask for a nudge; you can reveal more help one step at a time.
                </p>
                <p className="font-body text-xs text-text-secondary mt-3">
                  Your messages are sent to AI services to run this practice. We only save text for human review if you choose to share it after the session. <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent underline">Privacy details</a>
                </p>
              </section>
            )}
            <ConversationView
              messages={messages}
              onReplyFeedback={(turnIndex, answer, reason) => measure({ event: 'reply_understood', sessionId: sessionKey, scenarioId, proficiencyLevel, turnIndex, answer, reason })}
              isLoading={isLoading}
              isWarmingUp={warmingUp}
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

            {failedTurn && (
              <div role="alert" className="mt-6 bg-surface border-l-2 border-accent px-5 py-4">
                <p className="font-body text-sm text-text mb-3">The partner did not answer. Your message is still here.</p>
                <div className="flex gap-4 font-ui text-xs text-accent">
                  <button onClick={retryFailedTurn} type="button" className="underline underline-offset-4">Try again</button>
                  <button onClick={editFailedTurn} type="button" className="underline underline-offset-4">Edit message</button>
                </div>
              </div>
            )}

            {/* Live transcript widget display box */}
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
        <div className="shrink-0 max-h-[55dvh] overflow-y-auto bg-paper/95 backdrop-blur-md border-t border-divider pt-6 pb-8 md:pb-10">
          <div className="max-w-2xl mx-auto px-6">

            {/* Level adjustment suggestion banner */}
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
              {!showSuggestions && !isListening && !isSpeaking && !isLoading && !drillEnded && !failedTurn && (
                <button
                  onClick={fetchSuggestions}
                  disabled={isFetchingSuggestions}
                  className="group font-ui text-xs uppercase tracking-widest text-accent hover:text-dark transition-colors flex items-center gap-3 disabled:opacity-50"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-accent group-hover:scale-125 transition-transform" />
                  {isFetchingSuggestions ? 'Fetching Guidance...' : 'Stuck? See suggestions'}
                </button>
              )}

              <ReplySuggestions
                suggestions={suggestions}
                step={hintStep}
                onAdvance={() => {
                  const next = hintStep === 1 ? 2 : 3;
                  setHintStep(next);
                  measure({ event: 'hint_step_revealed', sessionId: sessionKey, scenarioId, proficiencyLevel, hintStep: next });
                }}
                onSelect={handleSuggestionSelect}
                isVisible={showSuggestions && !drillEnded && !isListening && !isSpeaking}
              />
              {suggestionError && !drillEnded && (
                <p role="alert" className="mt-3 font-ui text-xs text-accent-warm text-center">
                  {suggestionError}
                </p>
              )}
            </div>

            {/* Mode toggle selectors */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-surface border border-divider rounded-sm p-1">
                <button
                  onClick={() => setUseTextMode(false)}
                  className={`px-6 py-2 font-ui text-xs uppercase tracking-widest rounded-sm transition-all duration-base ${!useTextMode
                      ? 'bg-accent text-text-inverse shadow-sm'
                      : 'text-text-secondary hover:text-dark'
                    }`}
                >
                  Voice
                </button>
                <button
                  onClick={() => setUseTextMode(true)}
                  className={`px-6 py-2 font-ui text-xs uppercase tracking-widest rounded-sm transition-all duration-base ${useTextMode
                      ? 'bg-accent text-text-inverse shadow-sm'
                      : 'text-text-secondary hover:text-dark'
                    }`}
                >
                  Text
                </button>
              </div>
            </div>

            {/* Aside toggle — arms the next message as an out-of-character side question,
                reachable from both Voice and Text mode */}
            <div className="flex justify-center mb-4">
              <button
                type="button"
                onClick={() => setAsideMode((prev) => !prev)}
                disabled={isLoading || drillEnded || Boolean(failedTurn)}
                aria-pressed={asideMode}
                className={`px-4 py-1.5 font-ui text-xs uppercase tracking-widest rounded-sm border border-dashed transition-colors duration-fast disabled:opacity-30 ${
                  asideMode
                    ? 'border-accent text-accent'
                    : 'border-[var(--color-text-secondary)]/50 text-text-secondary hover:text-dark'
                }`}
              >
                {asideMode ? 'Aside armed · next message' : 'Ask a side question'}
              </button>
            </div>

            {/* Input Controls Container layout */}
            {useTextMode ? (
              <form onSubmit={handleTextSubmit} className="flex gap-4">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={`Respond in ${scenario.language.charAt(0).toUpperCase() + scenario.language.slice(1)} or English...`}
                  disabled={isLoading || drillEnded || Boolean(failedTurn)}
                  className="flex-1 bg-white border border-divider rounded-sm px-6 py-4 font-body text-text placeholder-text-secondary/50 focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isLoading || drillEnded || Boolean(failedTurn)}
                  className="px-8 bg-accent text-text-inverse font-ui text-caption uppercase tracking-widest hover:bg-[#A84E22] transition-colors duration-fast disabled:opacity-30"
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
                      isLoading={isLoading || Boolean(failedTurn) || drillEnded}
                      onPress={handleMicPress}
                      onRelease={handleMicRelease}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modals & Overlays loading indicators */}
        <EvaluationLoading isVisible={isEvaluating} />

        {showFeedback && (
          <FeedbackCard
            {...(roleplayHistory(messages).filter((m) => m.role === 'user').length < 2
              ? {
                state: 'short' as const,
                onContinue: continueDrill,
                onClose: leaveDrill,
                saveAction: metrics.turnCount > 0 ? <SaveProgressAction scenarioId={scenarioId} proficiencyLevel={proficiencyLevel} turnCount={metrics.turnCount} sessionKey={sessionKey} /> : undefined,
                shareAction: metrics.turnCount > 0 ? <ShareConversationAction scenarioId={scenarioId} proficiencyLevel={proficiencyLevel} messages={messages} /> : undefined,
              }
              : evaluationError
              ? {
                state: 'error' as const,
                errorMessage: evaluationError,
                onRetry: fetchEvaluation,
                onContinue: continueDrill,
                onClose: leaveDrill,
                saveAction: metrics.turnCount > 0 ? <SaveProgressAction scenarioId={scenarioId} proficiencyLevel={proficiencyLevel} turnCount={metrics.turnCount} sessionKey={sessionKey} /> : undefined,
                shareAction: metrics.turnCount > 0 ? <ShareConversationAction scenarioId={scenarioId} proficiencyLevel={proficiencyLevel} messages={messages} /> : undefined,
              }
              : {
                state: 'success' as const,
                evaluation: evaluation!,
                metrics: metrics,
                proficiencyLevel,
                startingLevel,
                onClose: leaveDrill,
                saveAction: metrics.turnCount > 0 ? <SaveProgressAction scenarioId={scenarioId} proficiencyLevel={proficiencyLevel} turnCount={metrics.turnCount} sessionKey={sessionKey} /> : undefined,
                shareAction: metrics.turnCount > 0 ? <ShareConversationAction scenarioId={scenarioId} proficiencyLevel={proficiencyLevel} messages={messages} /> : undefined,
                onTryAgain: () => {
                  clearSession(scenarioId);
                  setSessionKey(crypto.randomUUID());
                  setStartedAt(Date.now());
                  replaceMessages([]);
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
