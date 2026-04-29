import { Artifact, ArtifactType } from '@/types/artifact.types';
import { v4 as uuidv4 } from 'uuid';

// Patterns de détection dans le texte de l'IA
const CODE_BLOCK_REGEX = /```(\w+)?\n([\s\S]*?)```/g;
const ARTIFACT_TAG_REGEX = /<artifact\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/artifact>/g;

function detectArtifactType(language: string, code: string): ArtifactType {
  const lang = language?.toLowerCase();
  if (lang === 'html' || code.trim().startsWith('<!DOCTYPE') || code.includes('<html')) return 'html';
  if (lang === 'jsx' || lang === 'tsx' || lang === 'react') return 'react';
  if (lang === 'svg' || code.trim().startsWith('<svg')) return 'svg';
  if (lang === 'md' || lang === 'markdown') return 'markdown';
  if (lang === 'js' || lang === 'javascript' || lang === 'ts' || lang === 'typescript') return 'javascript';
  if (lang === 'css') return 'css';
  return 'unknown';
}

function generateTitle(type: ArtifactType, code: string): string {
  // Essaie d'extraire un titre pertinent du code
  const titleMatch = code.match(/<title>(.*?)<\/title>/i);
  if (titleMatch) return titleMatch[1];
  const h1Match = code.match(/# (.+)/);
  if (h1Match) return h1Match[1];
  const componentMatch = code.match(/(?:function|const|export default)\s+([A-Z][a-zA-Z]+)/);
  if (componentMatch) return componentMatch[1];

  const typeLabels: Record<ArtifactType, string> = {
    html: 'Page HTML',
    react: 'Composant React',
    svg: 'Graphique SVG',
    markdown: 'Document',
    javascript: 'Script JavaScript',
    css: 'Feuille de style',
    unknown: 'Code',
  };
  return typeLabels[type];
}

export function extractArtifactsFromResponse(
  responseText: string,
  messageId: string
): Artifact[] {
  const artifacts: Artifact[] = [];

  // Méthode 1 : Tags <artifact> explicites (format AgentOS)
  let match;
  ARTIFACT_TAG_REGEX.lastIndex = 0;
  while ((match = ARTIFACT_TAG_REGEX.exec(responseText)) !== null) {
    const [, type, title, code] = match;
    artifacts.push({
      id: uuidv4(),
      type: type as ArtifactType,
      title,
      code: code.trim(),
      language: type,
      timestamp: Date.now(),
      version: 1,
      messageId,
    });
  }

  // Méthode 2 : Blocs de code markdown (fallback)
  if (artifacts.length === 0) {
    CODE_BLOCK_REGEX.lastIndex = 0;
    while ((match = CODE_BLOCK_REGEX.exec(responseText)) !== null) {
      const [, language = '', code] = match;
      const type = detectArtifactType(language, code);

      // Ne créer un artifact que pour les types rendables
      if (type !== 'unknown' || code.length > 200) {
        artifacts.push({
          id: uuidv4(),
          type,
          title: generateTitle(type, code),
          code: code.trim(),
          language: language || 'text',
          timestamp: Date.now(),
          version: 1,
          messageId,
        });
      }
    }
  }

  return artifacts;
}

// Prépare le code HTML pour l'injection dans l'iframe
export function prepareHtmlForPreview(artifact: Artifact): string {
  switch (artifact.type) {
    case 'html':
      return artifact.code;

    case 'react':
      // Wrap React/JSX dans une page HTML avec CDN Babel
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

    // Auto-detect et render le composant
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
