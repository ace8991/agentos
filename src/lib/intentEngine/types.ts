export type ResponseType =
  | 'text'           // Réponse texte pure
  | 'artifact_html'  // Page HTML complète
  | 'artifact_react' // Composant React
  | 'artifact_svg'   // Graphique SVG
  | 'artifact_md'    // Document Markdown long
  | 'artifact_js'    // Script JavaScript
  | 'artifact_css'   // Feuille de style
  | 'chart'          // Graphique de données (Chart.js)
  | 'mindmap'        // Carte mentale
  | 'table'          // Tableau comparatif
  | 'code_block'     // Snippet de code court
  | 'tool_calls'     // Actions système (filesystem/terminal)
  | 'mixed';         // Texte + Artifact

export type IntentCategory =
  | 'create_web'      // Créer quelque chose de web/visuel
  | 'create_doc'      // Créer un document/rapport
  | 'create_code'     // Écrire du code
  | 'explain'         // Expliquer un concept
  | 'compare'         // Comparer des choses
  | 'analyze_data'    // Analyser des données/chiffres
  | 'system_action'   // Action sur le PC (fichier/terminal/git)
  | 'brainstorm'      // Brainstorm/idées/plan
  | 'question'        // Question simple
  | 'conversation'    // Conversation informelle
  | 'debug'           // Déboguer du code
  | 'refactor';       // Refactorer du code

export interface IntentAnalysis {
  category: IntentCategory;
  responseType: ResponseType;
  artifactType?: string;
  artifactTitle?: string;
  artifactLanguage?: string;
  confidence: number;          // 0-1
  autoTriggerChart: boolean;   // Déclencher chart automatiquement
  autoTriggerMindmap: boolean; // Déclencher mindmap automatiquement
  reasons: string[];           // Pourquoi cette décision
  suggestedLength: 'short' | 'medium' | 'long';
  suggestedTone: 'formal' | 'casual' | 'technical';
}
