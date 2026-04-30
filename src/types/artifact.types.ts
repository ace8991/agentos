export type ArtifactType =
  | 'html'
  | 'react'
  | 'svg'
  | 'markdown'
  | 'javascript'
  | 'css'
  | 'unknown';

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  language: string;
  code: string;
  version: number;
  messageId: string;
  timestamp: number;
}

export type PanelMode = 'preview' | 'code' | 'split';

export interface ArtifactStore {
  artifacts: Record<string, Artifact>;
  activeId: string | null;
  isOpen: boolean;
  isFullscreen: boolean;
  mode: PanelMode;
}
