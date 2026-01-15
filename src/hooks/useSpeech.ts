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
  const [forceFallback, setForceFallback] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // We need to access startMediaRecording from within the recognition event handlers
  // which are defined in a useEffect. We use a ref to break the dependency cycle.
  const startMediaRecordingRef = useRef<() => void>(() => {});

  const startMediaRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setIsListening(false);
        
        // Send to API
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
            setTranscript((prev) => prev + ' ' + data.transcription);
          }
        } catch (err) {
          console.error('Transcription error:', err);
          setError('Failed to process audio');
        } finally {
          setInterimTranscript('');
          
          // Stop all tracks to release mic
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      setError(null);
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      // Don't show technical error to user if it's just a switch
      if (forceFallback) {
        setError('Microphone access issue. Please allow mic access.');
      } else {
        // First time failing? Try to force fallback next time or just show error
        setError('Microphone access denied');
      }
    }
  }, [forceFallback]);

  // Update the ref whenever the function changes
  useEffect(() => {
    startMediaRecordingRef.current = startMediaRecording;
  }, [startMediaRecording]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check for native support (Chrome/Edge)
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      
      // We support recording if getUserMedia works
      const hasMediaSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      setIsSupported(!!SpeechRecognition || hasMediaSupport);

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-NG';

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = (event) => {
          // If network error (common in Arc/Offline/Brave), switch to fallback automatically
          if (event.error === 'network') {
             console.log('Native speech network error, switching to server-side fallback...');
             setForceFallback(true);
             // Automatically restart using fallback logic
             startMediaRecordingRef.current();
          } else if (event.error === 'not-allowed') {
             setError('Microphone access denied');
             setIsListening(false);
          } else {
             console.warn('Speech recognition error:', event.error);
             setError(`Speech error: ${event.error}`);
             setIsListening(false);
          }
        };

        recognition.onresult = (event) => {
          let finalTranscript = '';
          let interim = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript;
            } else {
              interim += result[0].transcript;
            }
          }

          if (finalTranscript) {
            setTranscript((prev) => prev + finalTranscript);
          }
          setInterimTranscript(interim);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []); // Only run once on mount

  const startListening = useCallback(() => {
    // If we already detected that native fails, goes straight to fallback
    if (forceFallback) {
      startMediaRecording();
      return;
    }

    // Try native first
    if (recognitionRef.current) {
      try {
        setTranscript('');
        setInterimTranscript('');
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Native start failed, using fallback:', e);
        setForceFallback(true);
        startMediaRecording();
      }
    } else {
      // No native support, use fallback
      setTranscript('');
      setInterimTranscript('');
      startMediaRecording();
    }
  }, [forceFallback, startMediaRecording]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
         recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    
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


// --- Speech Synthesis Hook (ElevenLabs + Server-side) ---

interface UseSpeechSynthesisReturn {
  speak: (text: string, gender?: 'male' | 'female') => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio element
    audioRef.current = new Audio();
    audioRef.current.onended = () => setIsSpeaking(false);
    audioRef.current.onerror = () => setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string, gender?: 'male' | 'female') => {
    if (!text) return;
    
    try {
      setIsSpeaking(true);
      
      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // Fetch audio from our API
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, gender }),
      });

      if (!response.ok) throw new Error('TTS request failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
      }
    } catch (error) {
      console.error('Speech synthesis error:', error);
      setIsSpeaking(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsSpeaking(false);
    }
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported: true, // Always supported via server API
  };
}
