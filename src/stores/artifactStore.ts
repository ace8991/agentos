import { create } from 'zustand';
import { Artifact, ArtifactStore, PanelMode } from '@/types/artifact.types';

interface ArtifactActions {
  upsertArtifact: (artifact: Artifact) => void;
  setActive: (id: string) => void;
  openPanel: (id: string) => void;
  closePanel: () => void;
  setMode: (mode: PanelMode) => void;
  toggleFullscreen: () => void;
  getActive: () => Artifact | null;
}

export const useArtifactStore = create<ArtifactStore & ArtifactActions>(
  (set, get) => ({
    artifacts: {},
    activeId: null,
    isOpen: false,
    isFullscreen: false,
    mode: 'preview',

    // ✅ Upsert : ajoute si nouveau, ignore si identique, update si modifié
    upsertArtifact: (artifact) =>
      set((s) => {
        const existing = s.artifacts[artifact.id];
        if (existing) {
          // Même ID → même artifact. Vérifie si le code a changé.
          if (existing.code === artifact.code) {
            // Exactement le même contenu → ne rien faire
            return s;
          }
          // Code modifié → incrémente la version
          return {
            artifacts: {
              ...s.artifacts,
              [artifact.id]: {
                ...existing,
                code: artifact.code,
                version: existing.version + 1,
              },
            },
            activeId: artifact.id,
            isOpen: true,
          };
        }
        // Nouvel artifact
        return {
          artifacts: { ...s.artifacts, [artifact.id]: artifact },
          activeId: artifact.id,
          isOpen: true,
        };
      }),

    setActive: (id) => set({ activeId: id }),

    openPanel: (id) => set({ isOpen: true, activeId: id }),

    closePanel: () =>
      set({ isOpen: false, isFullscreen: false, activeId: null }),

    setMode: (mode) => set({ mode }),

    toggleFullscreen: () =>
      set((s) => ({ isFullscreen: !s.isFullscreen })),

    getActive: () => {
      const { artifacts, activeId } = get();
      return activeId ? (artifacts[activeId] ?? null) : null;
    },
  })
);
