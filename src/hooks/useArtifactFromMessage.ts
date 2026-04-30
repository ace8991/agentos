import { useEffect, useRef, useState } from 'react';
import { LogEntry } from '@/store/useStore';
import { useArtifactStore } from '@/stores/artifactStore';
import { extractArtifactFromEntry } from '@/lib/artifactDetector';
import { Artifact } from '@/types/artifact.types';

export function useArtifactFromMessage(entry: LogEntry, isStreaming?: boolean) {
  const { upsertArtifact, artifacts } = useArtifactStore();
  const [detectedArtifactId, setDetectedArtifactId] = useState<string | null>(null);
  const lastProcessedRef = useRef<string>('');

  useEffect(() => {
    // Only parse if it's an action log and not just an info message
    if (entry.type !== 'act' && entry.type !== 'shell' && entry.type !== 'file' && entry.type !== 'browser' && entry.type !== 'result') return;
    
    // Build a content hash to detect changes (tool_result may update after initial creation)
    const contentHash = `${entry.id}-${entry.actionType || ''}-${entry.tool_result ? JSON.stringify(entry.tool_result).slice(0, 200) : ''}-${isStreaming ? 'streaming' : 'done'}`;
    if (contentHash === lastProcessedRef.current) return;
    lastProcessedRef.current = contentHash;

    // We can run extraction multiple times if streaming updates the toolArgs
    const artifact = extractArtifactFromEntry(entry);
    if (artifact) {
      upsertArtifact(artifact);
      setDetectedArtifactId(artifact.id);
    }
  }, [entry, entry.tool_result, entry.actionType, upsertArtifact, isStreaming]);

  return {
    artifactId: detectedArtifactId,
    artifact: detectedArtifactId ? artifacts[detectedArtifactId] : null
  };
}
