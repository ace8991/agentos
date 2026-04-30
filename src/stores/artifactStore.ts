import { create } from 'zustand';
import { ArtifactStore, Artifact } from '@/types/artifact.types';

export const useArtifactStore = create<ArtifactStore>((set) => ({
  artifacts: {},
  activeArtifactId: null,
  panelState: 'hidden',
  viewMode: 'preview',

  addArtifact: (artifact: Artifact) =>
    set((state) => ({
      artifacts: { ...state.artifacts, [artifact.id]: artifact },
      activeArtifactId: artifact.id,
      panelState: state.panelState === 'hidden' ? 'split' : state.panelState,
    })),

  updateArtifact: (id: string, updates: Partial<Artifact>) =>
    set((state) => {
      const existing = state.artifacts[id];
      if (!existing) return state;
      return {
        artifacts: {
          ...state.artifacts,
          [id]: { ...existing, ...updates },
        },
      };
    }),

  setActiveArtifact: (id: string | null) =>
    set((state) => ({
      activeArtifactId: id,
      panelState: id && state.panelState === 'hidden' ? 'split' : state.panelState,
    })),

  setPanelState: (panelState: 'hidden' | 'split' | 'fullscreen') =>
    set({ panelState }),

  setViewMode: (viewMode: 'preview' | 'code') =>
    set({ viewMode }),

  closePanel: () =>
    set({ panelState: 'hidden', activeArtifactId: null }),
}));
