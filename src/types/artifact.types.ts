export type ArtifactLanguage =
  | 'html'
  | 'javascript'
  | 'typescript'
  | 'css'
  | 'json'
  | 'python'
  | 'markdown'
  | 'text'
  | 'react'
  | 'shell';

export interface Artifact {
  id: string; // The tool call ID or generated ID
  type: 'code' | 'website' | 'data' | 'markdown';
  title: string;
  content: string;
  language: ArtifactLanguage;
  path?: string; // Optional path if it's an actual file
  createdAt: string;
}

export interface ArtifactStore {
  artifacts: Record<string, Artifact>;
  activeArtifactId: string | null;
  panelState: 'hidden' | 'split' | 'fullscreen';
  viewMode: 'preview' | 'code';
  
  // Actions
  addArtifact: (artifact: Artifact) => void;
  updateArtifact: (id: string, updates: Partial<Artifact>) => void;
  setActiveArtifact: (id: string | null) => void;
  setPanelState: (state: 'hidden' | 'split' | 'fullscreen') => void;
  setViewMode: (mode: 'preview' | 'code') => void;
  closePanel: () => void;
}
