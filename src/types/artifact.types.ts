export type ArtifactType =
  | 'html'        // Page HTML complète
  | 'react'       // Composant JSX/TSX
  | 'svg'         // Graphique SVG
  | 'markdown'    // Document Markdown rendu
  | 'javascript'  // Script JS exécutable
  | 'css'         // Feuille de style preview
  | 'unknown';    // Code affiché seulement

export interface Artifact {
  id: string;                    // UUID unique
  type: ArtifactType;           // Type détecté
  title: string;                 // Titre extrait ou généré
  code: string;                  // Code source complet
  language: string;              // Langage pour syntax highlighting
  timestamp: number;             // Date de création
  version: number;               // Incrément à chaque update
  messageId: string;             // ID du message IA parent
}

export interface ArtifactState {
  artifacts: Map<string, Artifact>;
  activeArtifactId: string | null;
  panelMode: 'preview' | 'code' | 'split';
  isPanelOpen: boolean;
  isPanelFullscreen: boolean;
}

export interface ArtifactPanelProps {
  artifact: Artifact | null;
  onClose: () => void;
}
