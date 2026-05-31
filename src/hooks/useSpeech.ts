'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// --- Speech Recognition Hook (Server-side Gemini Fallback) ---

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  isSupported: boolean;
  error: string | null;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setIsSupported(!!(navigator.mediaDevices?.getUserMedia));
  }, []);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(
        (t) => MediaRecorder.isTypeSupported(t)
      );
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: actualMimeType });
        setIsListening(false);

        try {
          setInterimTranscript('Processing audio...');
          const formData = new FormData();
          formData.append('audio', blob);

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) throw new Error('Transcription failed');

          const data = await response.json();
          if (data.transcription) {
            setTranscript((prev) => (prev + ' ' + data.transcription).trim());
          }
        } catch (err) {
          console.error('Transcription error:', err);
          setError('Failed to process audio');
        } finally {
          setInterimTranscript('');
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      setError(null);
    } catch (err: unknown) {
      console.error('Microphone error:', err);
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Microphone access denied');
      } else {
        setError('Microphone unavailable');
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error,
  };
}

// --- Speech Synthesis Hook ---
interface UseSpeechSynthesisReturn {
  speak: (text: string, gender?: 'male' | 'female') => void;
  stop: () => void;
  isSpeaking: boolean;
  usingFallback: boolean;
  error: string | null;
  isSupported: boolean;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);
  // Track whether we're in the middle of a server TTS request
  // so we can abort if stop() is called before it completes
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => {
      setIsSpeaking(false);
      setUsingFallback(false);
      // Clean up object URL after playback
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }
    };
    audioRef.current.onerror = () => {
      setIsSpeaking(false);
      setError('Audio playback error');
    };

    return () => {
      // Cleanup on unmount
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      }
    };
  }, []);

  const stopBrowserSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const stopServerAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
    // Abort any in-flight fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const speak = useCallback(async (text: string, gender?: 'male' | 'female') => {
    if (!text) return;

    // Stop everything currently playing before starting new speech
    stopServerAudio();
    stopBrowserSpeech();

    setIsSpeaking(true);
    setError(null);
    setUsingFallback(false);

    // Create a new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, gender: gender ?? 'male' }),
        signal: abortController.signal,
      });

      if (!response.ok) throw new Error('TTS server request failed');

      const blob = await response.blob();

      // Check if we were aborted while waiting for the response
      if (abortController.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      currentObjectUrlRef.current = url;

      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
      }
    } catch (err: unknown) {
      // If aborted, just clean up silently
      if ((err as { name?: string })?.name === 'AbortError') {
        setIsSpeaking(false);
        return;
      }

      console.warn('Server TTS failed, using browser fallback:', err);
      setUsingFallback(true);

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        // Make sure browser speech is clear before starting
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'yo-NG';

        utterance.onstart = () => {
          setIsSpeaking(true);
        };
        utterance.onend = () => {
          setIsSpeaking(false);
          setUsingFallback(false);
        };
        utterance.onerror = (e) => {
          // Ignore 'interrupted' errors — they're caused by cancel() calls
          if (e.error === 'interrupted') return;
          console.error('Browser TTS Error:', e);
          setIsSpeaking(false);
          setUsingFallback(false);
          setError('Speech synthesis failed');
        };

        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
        setError('Speech not supported on this device');
      }
    }
  }, [stopServerAudio, stopBrowserSpeech]);

  const stop = useCallback(() => {
    stopServerAudio();
    stopBrowserSpeech();
    setIsSpeaking(false);
    setUsingFallback(false);
  }, [stopServerAudio, stopBrowserSpeech]);

  return {
    speak,
    stop,
    isSpeaking,
    usingFallback,
    error,
    isSupported: true,
  };
}