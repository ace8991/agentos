import { useEffect, useRef, useState } from 'react';

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
  message?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const getRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;

  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
};

interface UseSpeechInputOptions {
  onTranscript: (text: string) => void;
  lang?: string;
}

export const useSpeechInput = ({ onTranscript, lang = 'en-US' }: UseSpeechInputOptions) => {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const Recognition = getRecognitionConstructor();
    setSupported(Boolean(Recognition));

    if (!Recognition) {
      recognitionRef.current = null;
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length - event.resultIndex }, (_, index) => {
        const result = event.results[event.resultIndex + index];
        return result?.[0]?.transcript || '';
      })
        .join(' ')
        .trim();

      if (transcript) {
        onTranscript(transcript);
      }
    };

    recognition.onerror = (event) => {
      setError(event.message || event.error || 'Speech recognition failed');
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang, onTranscript]);

  const start = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError('Speech recognition is not supported in this browser');
      return false;
    }

    setError(null);
    setListening(true);
    try {
      recognition.start();
      return true;
    } catch (caughtError) {
      setListening(false);
      setError(caughtError instanceof Error ? caughtError.message : 'Could not start speech recognition');
      return false;
    }
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const toggle = () => {
    if (listening) {
      stop();
      return true;
    }
    return start();
  };

  return {
    supported,
    listening,
    error,
    start,
    stop,
    toggle,
  };
};

