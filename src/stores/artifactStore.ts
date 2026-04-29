import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Artifact, ArtifactPanelState, PanelMode } from '@/types/artifact.types';

interface ArtifactStore extends ArtifactPanelState {
  // Actions
  addArtifact: (artifact: Artifact) => void;
  addOrUpdateArtifact: (artifact: Artifact) => void;
  updateArtifact: (id: string, updates: Partial<Artifact>) => void;
  removeArtifact: (id: string) => void;
  setActiveArtifact: (id: string | null) => void;
  setPanelMode: (mode: PanelMode) => void;
  openPanel: (artifactId: string) => void;
  closePanel: () => void;
  toggleFullscreen: () => void;
  getActiveArtifact: () => Artifact | null;
  getArtifactsByMessage: (messageId: string) => Artifact[];
}

export const useArtifactStore = create<ArtifactStore>()(
  persist(
    (set, get) => ({
      artifacts: {},
      activeArtifactId: null,
      panelMode: 'preview',
      isPanelOpen: false,
      isPanelFullscreen: false,

      addArtifact: (artifact) => {
        set((state) => ({
          artifacts: { ...state.artifacts, [artifact.id]: artifact },
        }));
      },

      addOrUpdateArtifact: (artifact) => {
        set((state) => {
          // Cherche un artifact existant avec le même filePath
          const existing = Object.values(state.artifacts).find(
            (a) => a.filePath && artifact.filePath && a.filePath === artifact.filePath,
          );
          if (existing) {
            return {
              artifacts: {
                ...state.artifacts,
                [existing.id]: {
                  ...existing,
                  code: artifact.code,
                  version: existing.version + 1,
                  timestamp: Date.now(),
                },
              },
            };
          }
          return { artifacts: { ...state.artifacts, [artifact.id]: artifact } };
        });
      },

      updateArtifact: (id, updates) => {
        set((state) => {
          const existing = state.artifacts[id];
          if (!existing) return state;
          return {
            artifacts: {
              ...state.artifacts,
              [id]: { ...existing, ...updates, version: existing.version + 1 },
            },
          };
        });
      },

      removeArtifact: (id) => {
        set((state) => {
          const { [id]: _, ...rest } = state.artifacts;
          return { artifacts: rest };
        });
      },

      setActiveArtifact: (id) => set({ activeArtifactId: id }),

      setPanelMode: (mode) => set({ panelMode: mode }),

      openPanel: (artifactId) =>
        set({
          isPanelOpen: true,
          activeArtifactId: artifactId,
        }),

      closePanel: () =>
        set({
          isPanelOpen: false,
          isPanelFullscreen: false,
          activeArtifactId: null,
        }),

      toggleFullscreen: () =>
        set((state) => ({
          isPanelFullscreen: !state.isPanelFullscreen,
        })),

      getActiveArtifact: () => {
        const { artifacts, activeArtifactId } = get();
        return activeArtifactId ? artifacts[activeArtifactId] ?? null : null;
      },

      getArtifactsByMessage: (messageId) => {
        const { artifacts } = get();
        return Object.values(artifacts).filter((a) => a.messageId === messageId);
      },
    }),
    {
      name: 'agentos-artifacts',
      partialize: (state) => ({
        artifacts: state.artifacts,
        panelMode: state.panelMode,
      }),
    },
  ),
);
