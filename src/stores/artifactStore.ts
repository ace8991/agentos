import { create } from 'zustand';
import { Artifact, ArtifactState } from '@/types/artifact.types';

interface ArtifactStore extends ArtifactState {
  // Actions
  addArtifact: (artifact: Artifact) => void;
  updateArtifact: (id: string, updates: Partial<Artifact>) => void;
  setActiveArtifact: (id: string | null) => void;
  setPanelMode: (mode: 'preview' | 'code' | 'split') => void;
  openPanel: (artifactId: string) => void;
  closePanel: () => void;
  toggleFullscreen: () => void;
  getActiveArtifact: () => Artifact | null;
}

export const useArtifactStore = create<ArtifactStore>((set, get) => ({
  artifacts: new Map(),
  activeArtifactId: null,
  panelMode: 'preview',
  isPanelOpen: false,
  isPanelFullscreen: false,

  addArtifact: (artifact) => {
    set((state) => {
      const newMap = new Map(state.artifacts);
      newMap.set(artifact.id, artifact);
      return { artifacts: newMap };
    });
  },

  updateArtifact: (id, updates) => {
    set((state) => {
      const newMap = new Map(state.artifacts);
      const existing = newMap.get(id);
      if (existing) {
        newMap.set(id, { ...existing, ...updates, version: existing.version + 1 });
      }
      return { artifacts: newMap };
    });
  },

  setActiveArtifact: (id) => set({ activeArtifactId: id }),

  setPanelMode: (mode) => set({ panelMode: mode }),

  openPanel: (artifactId) => set({
    isPanelOpen: true,
    activeArtifactId: artifactId,
  }),

  closePanel: () => set({
    isPanelOpen: false,
    isPanelFullscreen: false,
    activeArtifactId: null,
  }),

  toggleFullscreen: () => set((state) => ({
    isPanelFullscreen: !state.isPanelFullscreen,
  })),

  getActiveArtifact: () => {
    const { artifacts, activeArtifactId } = get();
    return activeArtifactId ? artifacts.get(activeArtifactId) ?? null : null;
  },
}));
