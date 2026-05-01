import { useState, useCallback } from 'react';
import { detectIntent } from '@/lib/intentEngine/detector';
import type { IntentAnalysis } from '@/lib/intentEngine/types';

export function useIntentEngine() {
  const [lastIntent, setLastIntent] = useState<IntentAnalysis | null>(null);

  const analyzeAndPrepare = useCallback((
    message: string,
    conversationHistory?: string[],
    backendOnline?: boolean
  ): IntentAnalysis => {
    const intent = detectIntent(message, conversationHistory, backendOnline);
    setLastIntent(intent);

    // Log en dev pour déboguer les décisions
    if (import.meta.env.DEV) {
      console.group(`[IntentEngine] ${intent.category}`);
      console.log('Response type:', intent.responseType);
      console.log('Confidence:', intent.confidence);
      console.log('Reasons:', intent.reasons);
      console.log('Auto chart:', intent.autoTriggerChart);
      console.log('Auto mindmap:', intent.autoTriggerMindmap);
      console.groupEnd();
    }

    return intent;
  }, []);

  return { analyzeAndPrepare, lastIntent };
}
