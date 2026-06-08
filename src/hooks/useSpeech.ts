'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// --- Speech Recognition Hook ---

interface UseSpeechRecognitionOptions {
  lang?: string;
  onTranscriptionComplete?: (text: string) => void;
}

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

export function useSpeechRecognition(options?: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

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

          const languageCode = optionsRef.current?.lang?.startsWith('ha') ? 'hausa' : 'yoruba';
          formData.append('language', languageCode);

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) throw new Error('Transcription failed');

          const data = await response.json();

          // =========================================================
          // ASYNCHRONOUS HAUSA COUPLING: Client Side Polling Verification Loop
          // =========================================================
          if (response.status === 202 && data.callId) {
            let transcriptResult = '';
            const maxAttempts = 45; 
            
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
              const pollResponse = await fetch(`/api/transcribe?callId=${data.callId}`);
              
              if (pollResponse.ok) {
                const resultData = await pollResponse.json();
                
                if (resultData.status === 'completed') {
                  transcriptResult = resultData.text || '';
                  break;
                }
                if (resultData.status === 'failed') {
                  throw new Error(`Modal worker engine failure: ${resultData.error}`);
                }
              }
              // Wait 1 second before querying worker grid queue allocation status again
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            const finalizedTranscript = transcriptResult.trim();
            if (!finalizedTranscript) {
              throw new Error('Could not transcribe Hausa audio');
            }

            setTranscript((prev) => (prev + ' ' + finalizedTranscript).trim());
            
            // Invoke the callback pattern to trigger UI stream updates
            if (optionsRef.current?.onTranscriptionComplete) {
              optionsRef.current.onTranscriptionComplete(finalizedTranscript);
            }

          // =========================================================
          // DIRECT YORUBA PIPELINE CONNECTION
          // =========================================================
          } else if (data.transcription) {
            const directTranscript = data.transcription.trim();
            setTranscript((prev) => (prev + ' ' + directTranscript).trim());
            
            if (optionsRef.current?.onTranscriptionComplete) {
              optionsRef.current.onTranscriptionComplete(directTranscript);
            }
          }
        } catch (err) {
          console.error('Transcription error:', err);
          setError('Failed to process audio');
        } finally {
          setInterimTranscript('');
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start(250);
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
      mediaRecorderRef.current.requestData();
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

interface UseSpeechSynthesisOptions {
  lang?: string;
}

interface UseSpeechSynthesisReturn {
  speak: (text: string, gender?: 'male' | 'female') => void;
  stop: () => void;
  isSpeaking: boolean;
  usingFallback: boolean;
  error: string | null;
  isSupported: boolean;
}

export function useSpeechSynthesis(options?: UseSpeechSynthesisOptions): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => {
      setIsSpeaking(false);
      setUsingFallback(false);
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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const speak = useCallback(async (text: string, gender?: 'male' | 'female') => {
    if (!text) return;

    stopServerAudio();
    stopBrowserSpeech();

    setIsSpeaking(true);
    setError(null);
    setUsingFallback(false);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const languagePayload = options?.lang?.startsWith('ha') ? 'hausa' : 'yoruba';
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, gender: gender ?? 'male', language: languagePayload }),
        signal: abortController.signal,
      });

      if (!response.ok) throw new Error('TTS server request failed');

      const blob = await response.blob();
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      }

      const audioUrl = URL.createObjectURL(blob);
      currentObjectUrlRef.current = audioUrl;

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        await audioRef.current.play();
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('TTS execution fell back to system native engines:', err);
      setUsingFallback(true);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = options?.lang || 'en-US';
        utterance.onend = () => {
          setIsSpeaking(false);
          setUsingFallback(false);
        };
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
      }
    }
  }, [options, stopBrowserSpeech, stopServerAudio]);

  const stop = useCallback(() => {
    stopServerAudio();
    stopBrowserSpeech();
    setIsSpeaking(false);
    setUsingFallback(false);
  }, [stopBrowserSpeech, stopServerAudio]);

  return {
    speak,
    stop,
    isSpeaking,
    usingFallback,
    error,
    isSupported: true,
  };
}