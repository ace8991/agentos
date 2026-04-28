import { useCallback, useEffect, useRef, useState } from 'react';
import { chatDirect, type ChatMessage } from '@/lib/api';
import { useStore } from '@/store/useStore';

export type ParlorState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

const VAD_THRESHOLD = 30;
const VAD_SILENCE_MS = 1500;
const FRAME_CAPTURE_INTERVAL = 3000;

export const useParlorSession = () => {
  const [state, setState] = useState<ParlorState>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const lastFrameRef = useRef<string | null>(null);
  const isActiveRef = useRef(false);
  const vadRafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const model = useStore((s) => s.model);

  // Keep ref in sync so the unmount cleanup always sees the latest stream
  useEffect(() => { streamRef.current = stream; }, [stream]);

  // Initialize media
  const startSession = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: cameraEnabled,
      });
      setStream(mediaStream);

      // Setup audio analyser
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(mediaStream);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 256;
      source.connect(analyserNode);
      setAnalyser(analyserNode);

      // Setup speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setError('Speech recognition not supported');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'fr-FR';
      recognitionRef.current = recognition;

      isActiveRef.current = true;
      setState('listening');
      startListening();

      // Setup periodic frame capture
      if (cameraEnabled) {
        captureCanvasRef.current = document.createElement('canvas');
        frameIntervalRef.current = window.setInterval(() => {
          captureFrame();
        }, FRAME_CAPTURE_INTERVAL);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start');
    }
  }, [cameraEnabled, captureFrame, startListening]);

  const captureFrame = useCallback(() => {
    const video = document.querySelector('video[autoplay]') as HTMLVideoElement | null;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;

    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 320, 240);
    lastFrameRef.current = canvas.toDataURL('image/jpeg', 0.5);
  }, []);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || !isActiveRef.current) return;

    let currentTranscript = '';

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      currentTranscript = finalText || interimText;

      // Reset silence timer
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = window.setTimeout(() => {
        if (currentTranscript.trim()) {
          processUserInput(currentTranscript.trim());
          currentTranscript = '';
        }
      }, VAD_SILENCE_MS);
    };

    recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.error('Speech error:', e.error);
      }
    };

    recognition.onend = () => {
      if (isActiveRef.current && state !== 'processing' && state !== 'speaking') {
        try { recognition.start(); } catch {}
      }
    };

    try { recognition.start(); } catch {}
  }, [state, processUserInput]);

  const processUserInput = useCallback(async (text: string) => {
    // Barge-in: cancel any ongoing speech
    window.speechSynthesis.cancel();

    setState('processing');

    const userEntry: TranscriptEntry = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    setTranscript(prev => [...prev, userEntry]);

    // Build messages with optional vision context
    const messages: ChatMessage[] = [];
    const visionContext = lastFrameRef.current
      ? `\n[L'utilisateur montre sa caméra. Description du frame actuel disponible.]`
      : '';

    messages.push({
      role: 'user',
      content: text + visionContext,
    });

    let assistantText = '';
    const assistantId = crypto.randomUUID();

    try {
      await chatDirect(
        messages,
        model,
        null,
        false,
        (token) => {
          assistantText += token;
          setTranscript(prev => {
            const existing = prev.find(e => e.id === assistantId);
            if (existing) {
              return prev.map(e => e.id === assistantId ? { ...e, text: assistantText } : e);
            }
            return [...prev, { id: assistantId, role: 'assistant', text: assistantText, timestamp: Date.now() }];
          });
        },
        () => {
          // Speak the response
          if (assistantText.trim()) {
            speakText(assistantText.trim());
          } else {
            setState('listening');
            try { recognitionRef.current?.start(); } catch {}
          }
        },
        (err) => {
          console.error('Chat error:', err);
          setState('listening');
          try { recognitionRef.current?.start(); } catch {}
        },
      );
    } catch {
      setState('listening');
      try { recognitionRef.current?.start(); } catch {}
    }
  }, [model, speakText]);

  const speakText = useCallback((text: string) => {
    setState('speaking');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.05;

    utterance.onend = () => {
      if (isActiveRef.current) {
        setState('listening');
        try { recognitionRef.current?.start(); } catch {}
      } else {
        setState('idle');
      }
    };

    utterance.onerror = () => {
      setState('listening');
      try { recognitionRef.current?.start(); } catch {}
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSession = useCallback(() => {
    isActiveRef.current = false;
    window.speechSynthesis.cancel();

    try { recognitionRef.current?.abort(); } catch {}
    recognitionRef.current = null;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    cancelAnimationFrame(vadRafRef.current);

    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setAnalyser(null);
    setState('idle');
  }, [stream]);

  const toggleCamera = useCallback(() => {
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach(t => { t.enabled = !t.enabled; });
      setCameraEnabled(prev => !prev);
    }
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      window.speechSynthesis.cancel();
      try { recognitionRef.current?.abort(); } catch {}
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      cancelAnimationFrame(vadRafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  return {
    state,
    transcript,
    stream,
    analyser,
    cameraEnabled,
    error,
    startSession,
    stopSession,
    toggleCamera,
  };
};
