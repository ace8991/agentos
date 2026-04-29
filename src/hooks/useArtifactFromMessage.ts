import { useMemo } from 'react';
import { useArtifactStore } from '@/stores/artifactStore';
import { Artifact } from '@/types/artifact.types';

/**
 * Hook qui retourne les artifacts associés à un message donné.
 */
export function useArtifactFromMessage(messageId: string | undefined): Artifact[] {
  const artifacts = useArtifactStore((state) => state.artifacts);

  return useMemo(() => {
    if (!messageId) return [];
    return Object.values(artifacts).filter((a) => a.messageId === messageId);
  }, [artifacts, messageId]);
}
