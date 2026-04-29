export type ArtifactType =
  | 'html'        // Page HTML complète
  | 'react'       // Composant JSX/TSX
  | 'svg'         // Graphique SVG
  | 'markdown'    // Document Markdown rendu
  | 'javascript'  // Script JS exécutable
  | 'css'         // Feuille de style preview
  | 'python'      // Script Python
  | 'unknown';    // Code affiché seulement

export type PanelMode = 'preview' | 'code' | 'split';

export interface Artifact {
  id: string;                    // UUID unique
  type: ArtifactType;           // Type détecté
  title: string;                 // Titre extrait ou généré
  code: string;                  // Code source complet
  language: string;              // Langage pour syntax highlighting
  timestamp: number;             // Date de création
  version: number;               // Incrémenté à chaque update
  messageId: string;             // ID du message IA parent
  filePath?: string;             // Chemin du fichier (pour déduplication)
}

export interface ArtifactPanelState {
  artifacts: Record<string, Artifact>;
  activeArtifactId: string | null;
  panelMode: PanelMode;
  isPanelOpen: boolean;
  isPanelFullscreen: boolean;
}

export interface ArtifactPanelProps {
  artifact: Artifact | null;
  onClose: () => void;
}
