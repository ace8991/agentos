import { create } from 'zustand';
import { Artifact, ArtifactStore, PanelMode } from '@/types/artifact.types';

interface ArtifactActions {
  addArtifact: (artifact: Artifact) => void;
  updateArtifact: (id: string, code: string) => void;
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

    addArtifact: (artifact) =>
      set((s) => ({
        artifacts: { ...s.artifacts, [artifact.id]: artifact },
        activeId: artifact.id,
        isOpen: true,
      })),

    updateArtifact: (id, code) =>
      set((s) => {
        const existing = s.artifacts[id];
        if (!existing) return s;
        return {
          artifacts: {
            ...s.artifacts,
            [id]: { ...existing, code, version: existing.version + 1 },
          },
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
