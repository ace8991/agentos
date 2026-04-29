import { v4 as uuidv4 } from 'uuid';
import { Artifact, ArtifactType } from '@/types/artifact.types';
import { ToolCallEvent, ToolResultEvent } from '@/lib/api';

/* ── Types ── */

export interface ToolCallWithResult {
  call: ToolCallEvent;
  result?: ToolResultEvent;
}

/* ── Détection du type d'artifact ── */

function detectArtifactType(language: string, code: string): ArtifactType {
  const lang = language?.toLowerCase();
  if (lang === 'html' || code.trim().startsWith('<!DOCTYPE') || code.includes('<html')) return 'html';
  if (lang === 'jsx' || lang === 'tsx' || lang === 'react') return 'react';
  if (lang === 'svg' || code.trim().startsWith('<svg')) return 'svg';
  if (lang === 'md' || lang === 'markdown') return 'markdown';
  if (lang === 'js' || lang === 'javascript' || lang === 'ts' || lang === 'typescript') return 'javascript';
  if (lang === 'css') return 'css';
  if (lang === 'py' || lang === 'python') return 'python';
  return 'unknown';
}

/* ── Génération de titre ── */

function generateTitle(type: ArtifactType, code: string, filePath?: string): string {
  // Priorité 1 : chemin de fichier
  if (filePath) {
    const name = filePath.split(/[\\/]/).pop() || filePath;
    return name;
  }

  // Priorité 2 : balise <title> dans le code
  const titleMatch = code.match(/<title>(.*?)<\/title>/i);
  if (titleMatch) return titleMatch[1];

  // Priorité 3 : titre markdown
  const h1Match = code.match(/# (.+)/);
  if (h1Match) return h1Match[1];

  // Priorité 4 : nom de composant React
  const componentMatch = code.match(/(?:function|const|export default)\s+([A-Z][a-zA-Z]+)/);
  if (componentMatch) return componentMatch[1];

  // Fallback par type
  const typeLabels: Record<ArtifactType, string> = {
    html: 'Page HTML',
    react: 'Composant React',
    svg: 'Graphique SVG',
    markdown: 'Document',
    javascript: 'Script JavaScript',
    css: 'Feuille de style',
    python: 'Script Python',
    unknown: 'Code',
  };
  return typeLabels[type];
}

/* ── Extraction du code depuis un tool call ── */

function extractCodeFromToolCall(toolCall: ToolCallEvent, toolResult?: ToolResultEvent): { code: string; language: string; filePath?: string } | null {
  const { tool, args } = toolCall;

  // Cas 1 : str_replace_editor avec command="create" ou "write"
  if (tool === 'str_replace_editor') {
    const command = String(args.command ?? '');
    const fileText = String(args.file_text ?? args.content ?? '');
    const path = String(args.path ?? '');

    if ((command === 'create' || command === 'write') && fileText) {
      const ext = path.split('.').pop()?.toLowerCase() || '';
      return { code: fileText, language: ext, filePath: path };
    }
    return null;
  }

  // Cas 2 : desktop_commander avec command="write_file"
  if (tool === 'desktop_commander') {
    const command = String(args.command ?? '');
    const content = String(args.content ?? '');
    const path = String(args.path ?? '');

    if (command === 'write_file' && content) {
      const ext = path.split('.').pop()?.toLowerCase() || '';
      return { code: content, language: ext, filePath: path };
    }
    return null;
  }

  // Cas 3 : bash_tool / execute_command avec contenu dans le résultat
  if (tool === 'bash_tool' || tool === 'execute_command') {
    const command = String(args.command ?? '');
    // On ne capture que les commandes qui écrivent des fichiers
    const writePatterns = [
      /cat\s+<<\s*'?EOF'?\s*>?\s*([^\s]+)/i,
      /echo\s+['"].*['"]\s*>\s*([^\s]+)/i,
      /printf\s+['"].*['"]\s*>\s*([^\s]+)/i,
    ];
    for (const pattern of writePatterns) {
      const match = command.match(pattern);
      if (match) {
        const path = match[1];
        // Le contenu est dans le résultat
        if (toolResult?.result) {
          const ext = path.split('.').pop()?.toLowerCase() || '';
          return { code: toolResult.result, language: ext, filePath: path };
        }
      }
    }
    return null;
  }

  return null;
}

/* ── API publique ── */

/**
 * Analyse un tool call individuel pour détecter un artifact.
 */
export function extractArtifactFromToolCall(
  toolCall: ToolCallEvent,
  toolResult?: ToolResultEvent,
  messageId?: string,
): Artifact | null {
  const extracted = extractCodeFromToolCall(toolCall, toolResult);
  if (!extracted) return null;

  const { code, language, filePath } = extracted;
  const type = detectArtifactType(language, code);

  // Ne créer un artifact que pour les types rendables
  if (type === 'unknown' && code.length < 200) return null;

  return {
    id: uuidv4(),
    type,
    title: generateTitle(type, code, filePath),
    code,
    language: language || 'text',
    timestamp: Date.now(),
    version: 1,
    messageId: messageId || '',
    filePath,
  };
}

/**
 * Analyse tous les tool calls d'un message pour extraire les artifacts.
 */
export function extractArtifactsFromMessage(
  toolCalls: ToolCallWithResult[],
  messageId: string,
): Artifact[] {
  const artifacts: Artifact[] = [];

  for (const { call, result } of toolCalls) {
    const artifact = extractArtifactFromToolCall(call, result, messageId);
    if (artifact) {
      artifacts.push(artifact);
    }
  }

  return artifacts;
}

/* ── Préparation pour iframe ── */

/**
 * Prépare le code HTML pour l'injection dans l'iframe de preview.
 */
export function prepareForIframe(artifact: Artifact): string {
  switch (artifact.type) {
    case 'html':
      return artifact.code;

    case 'react':
      return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>body { margin: 0; font-family: system-ui; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${artifact.code}

    if (typeof App !== 'undefined') {
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
    }
  </script>
</body>
</html>`;

    case 'svg':
      return `<!DOCTYPE html>
<html>
<head><style>
  body { margin: 0; display: flex; align-items: center; justify-content: center;
         min-height: 100vh; background: #f8f8f8; }
  svg { max-width: 100%; max-height: 100vh; }
</style></head>
<body>${artifact.code}</body>
</html>`;

    case 'markdown':
      return `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown.min.css">
  <style>
    body { margin: 0; padding: 2rem; background: white; }
    .markdown-body { max-width: 800px; margin: 0 auto; }
  </style>
</head>
<body class="markdown-body">
  <div id="content"></div>
  <script>
    document.getElementById('content').innerHTML = marked.parse(\`${artifact.code.replace(/`/g, '\\`')}\`);
  </script>
</body>
</html>`;

    default:
      return `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <style>body { margin: 0; } pre { margin: 0; height: 100vh; }</style>
</head>
<body>
  <pre><code class="language-${artifact.language}">${artifact.code.replace(/</g, '<').replace(/>/g, '>')}</code></pre>
  <script>hljs.highlightAll();</script>
</body>
</html>`;
  }
}
