import { useCallback, useRef } from 'react';
import { useArtifactStore } from '@/stores/artifactStore';
import { parseArtifactResponse } from '@/lib/artifactParser';

/**
 * Crée un gestionnaire de stream d'artifacts pour un messageId donné.
 * Version "pure" utilisable sans hook React (pour les callbacks async).
 */
export function createArtifactStreamHandler(messageId: string) {
  const store = useArtifactStore.getState();
  let fullText = '';
  const addedIds = new Set<string>();

  return {
    onChunk(chunk: string): string {
      fullText += chunk;
      const result = parseArtifactResponse(fullText, messageId);

      for (const artifact of result.artifacts) {
        if (!addedIds.has(artifact.id)) {
          addedIds.add(artifact.id);
          store.addArtifact(artifact);
        }
      }

      return result.cleanText;
    },

    onDone(): string {
      const result = parseArtifactResponse(fullText, messageId);

      for (const artifact of result.artifacts) {
        if (!addedIds.has(artifact.id)) {
          addedIds.add(artifact.id);
          store.addArtifact(artifact);
        }
      }

      return result.cleanText;
    },

    reset() {
      fullText = '';
      addedIds.clear();
    },
  };
}

/**
 * Hook React qui retourne des callbacks à brancher sur le système de streaming.
 *
 * Usage :
 *   const { onChunk, onDone, reset } = useArtifactStream(messageId);
 *
 *   stream.on('data', chunk => onChunk(chunk.text))
 *   stream.on('end', () => onDone())
 */
export function useArtifactStream(messageId: string) {
  const { addArtifact } = useArtifactStore();
  const fullTextRef = useRef('');
  const addedArtifactIds = useRef<Set<string>>(new Set());
  const cleanTextRef = useRef('');

  const onChunk = useCallback(
    (chunk: string): string => {
      fullTextRef.current += chunk;
      const result = parseArtifactResponse(fullTextRef.current, messageId);
      cleanTextRef.current = result.cleanText;

      for (const artifact of result.artifacts) {
        if (!addedArtifactIds.current.has(artifact.id)) {
          addedArtifactIds.current.add(artifact.id);
          addArtifact(artifact);
        }
      }

      return result.cleanText;
    },
    [messageId, addArtifact]
  );

  const onDone = useCallback((): string => {
    const result = parseArtifactResponse(fullTextRef.current, messageId);

    for (const artifact of result.artifacts) {
      if (!addedArtifactIds.current.has(artifact.id)) {
        addedArtifactIds.current.add(artifact.id);
        addArtifact(artifact);
      }
    }

    return result.cleanText;
  }, [messageId, addArtifact]);

  const reset = useCallback(() => {
    fullTextRef.current = '';
    cleanTextRef.current = '';
    addedArtifactIds.current = new Set();
  }, []);

  return { onChunk, onDone, reset };
}
