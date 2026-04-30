import { useEffect, useState } from 'react';
import { LogEntry } from '@/store/useStore';
import { useArtifactStore } from '@/stores/artifactStore';
import { extractArtifactFromEntry } from '@/lib/artifactDetector';
import { Artifact } from '@/types/artifact.types';

export function useArtifactFromMessage(entry: LogEntry, isStreaming?: boolean) {
  const { addArtifact, artifacts } = useArtifactStore();
  const [detectedArtifactId, setDetectedArtifactId] = useState<string | null>(null);

  useEffect(() => {
    // Only parse if it's an action log and not just an info message
    if (entry.type !== 'act' && entry.type !== 'shell' && entry.type !== 'file' && entry.type !== 'browser' && entry.type !== 'result') return;
    
    // We can run extraction multiple times if streaming updates the toolArgs
    const artifact = extractArtifactFromEntry(entry);
    if (artifact) {
      addArtifact(artifact);
      setDetectedArtifactId(artifact.id);
    }
  }, [entry, addArtifact, isStreaming]);

  return {
    artifactId: detectedArtifactId,
    artifact: detectedArtifactId ? artifacts[detectedArtifactId] : null
  };
}
