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
    // Supported if the browser can capture audio and send to server
    setIsSupported(!!(navigator.mediaDevices?.getUserMedia));
  }, []);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick best mimeType for this browser (audio/webm is Chrome-only)
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

// --- Speech Synthesis Hook (Modal + Browser Fallback) ---
interface UseSpeechSynthesisReturn {
  speak: (text: string, gender?: 'male' | 'female') => void;
  stop: () => void;
  isSpeaking: boolean;
  usingFallback: boolean; // Added for UI messaging
  error: string | null;    // Added for tightening error handling
  isSupported: boolean;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false); // Track fallback state
  const [error, setError] = useState<string | null>(null);    // Track errors
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio element
    audioRef.current = new Audio();
    audioRef.current.onended = () => setIsSpeaking(false);
    audioRef.current.onerror = () => {
      setIsSpeaking(false);
      setError("Audio playback error");
    };
  }, []);

  const speak = useCallback(async (text: string, gender?: 'male' | 'female') => {
    if (!text) return;
    
    try {
      setIsSpeaking(true);
      setError(null);
      setUsingFallback(false);
      
      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // Fetch audio from Google TTS API
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          gender: gender ?? 'male',
        }),
      });

      if (!response.ok) throw new Error('TTS server request failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
      }
    } catch (err) {
      console.warn('Server TTS failed, using browser fallback:', err);
      setUsingFallback(true); // Explicitly flag the fallback for UI messaging
      
      // --- BROWSER NATIVE FALLBACK ---
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        // Cancel any ongoing browser speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'yo-NG'; 
        
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          setUsingFallback(false);
        };
        utterance.onerror = (e) => {
          console.error("Browser TTS Error:", e);
          setIsSpeaking(false);
          setUsingFallback(false);
          setError("Speech synthesis failed");
        };
        
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
        setError("Speech not supported on this device");
      }
    }
  }, []);

  const stop = useCallback(() => {
    // Stop Server Audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    // Stop Browser Audio
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setUsingFallback(false);
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    usingFallback,
    error,
    isSupported: true,
  };
}
