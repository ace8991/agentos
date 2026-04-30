import { Artifact, ArtifactType } from '@/types/artifact.types';

// Regex pour détecter un artifact COMPLET (fermé)
const ARTIFACT_COMPLETE_REGEX =
  /<artifact\s+type="([^"]+)"\s+title="([^"]+)"\s+language="([^"]+)">([\s\S]*?)<\/artifact>/g;

// Regex pour détecter un artifact EN COURS (ouvert, pendant le stream)
const ARTIFACT_OPEN_REGEX =
  /<artifact\s+type="([^"]+)"\s+title="([^"]+)"\s+language="([^"]+)">([\s\S]*)/;

export interface ParseResult {
  // Le texte à afficher dans la bulle (sans les tags artifact)
  cleanText: string;
  // Les artifacts complets détectés
  artifacts: Artifact[];
  // Artifact en cours de stream (pas encore fermé)
  streamingArtifact: {
    type: ArtifactType;
    title: string;
    language: string;
    partialCode: string;
  } | null;
  // true si on est en train de streamer l'intérieur d'un artifact
  isInsideArtifact: boolean;
}

/**
 * Génère un ID déterministe basé sur le messageId, l'index et le titre.
 * Même message + même index + même titre = toujours le même ID.
 */
function stableId(messageId: string, index: number, title: string): string {
  return `artifact-${messageId}-${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/**
 * Parse le texte complet de la réponse du modèle.
 * Appelé à chaque chunk pendant le stream ET une fois à la fin.
 */
export function parseArtifactResponse(
  fullText: string,
  messageId: string
): ParseResult {
  const artifacts: Artifact[] = [];

  // 1. Extrait tous les artifacts COMPLETS
  let cleanText = fullText;
  ARTIFACT_COMPLETE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ARTIFACT_COMPLETE_REGEX.exec(fullText)) !== null) {
    const [fullMatch, type, title, language, code] = match;

    artifacts.push({
      id: stableId(messageId, artifacts.length, title),
      type: type as ArtifactType,
      title,
      language,
      code: code.trim(),
      version: 1,
      messageId,
      timestamp: Date.now(),
    });

    // Supprime le bloc artifact du texte visible
    cleanText = cleanText.replace(fullMatch, '').trim();
  }

  // 2. Détecte un artifact EN COURS (ouvert mais pas encore fermé)
  const hasClosingTag = fullText.includes('</artifact>');
  const openMatch = ARTIFACT_OPEN_REGEX.exec(fullText);
  let streamingArtifact = null;
  let isInsideArtifact = false;

  if (openMatch && !hasClosingTag) {
    const [fullOpenMatch, type, title, language, partialCode] = openMatch;
    streamingArtifact = {
      type: type as ArtifactType,
      title,
      language,
      partialCode: partialCode || '',
    };
    isInsideArtifact = true;
    // Supprime aussi l'artifact ouvert du texte visible
    cleanText = cleanText.replace(fullOpenMatch, '').trim();
  }

  return {
    cleanText,
    artifacts,
    streamingArtifact,
    isInsideArtifact,
  };
}

/**
 * Prépare le code d'un artifact pour l'injection dans l'iframe.
 */
export function prepareForIframe(artifact: {
  type: ArtifactType;
  language: string;
  code: string;
  title?: string;
}): string {
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
  <style>body{margin:0;font-family:system-ui;}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${artifact.code}
    if(typeof App!=='undefined'){
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
    }
  </script>
</body>
</html>`;

    case 'svg':
      return `<!DOCTYPE html>
<html><head><style>
  body{margin:0;display:flex;align-items:center;justify-content:center;
  min-height:100vh;background:#f5f5f5;}
  svg{max-width:100%;max-height:100vh;}
</style></head>
<body>${artifact.code}</body>
</html>`;

    case 'markdown':
      return `<!DOCTYPE html>
<html><head>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown-light.min.css">
  <style>body{padding:2rem;max-width:800px;margin:0 auto;}</style>
</head>
<body class="markdown-body">
<div id="c"></div>
<script>
  document.getElementById('c').innerHTML = marked.parse(\`${artifact.code.replace(/`/g, '\\`')}\`);
</script>
</body></html>`;

    case 'css':
      return `<!DOCTYPE html>
<html><head>
  <style>${artifact.code}</style>
</head>
<body>
  <div style="padding:2rem">
    <h1>Preview CSS</h1>
    <p>Paragraphe de texte normal.</p>
    <button>Bouton</button>
    <input placeholder="Champ texte" />
    <div class="card"><p>Carte</p></div>
    <ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>
  </div>
</body></html>`;

    case 'javascript':
      return `<!DOCTYPE html>
<html><head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <style>body{margin:0;}pre{margin:0;min-height:100vh;}</style>
</head>
<body>
  <pre><code class="language-javascript">${artifact.code
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')}</code></pre>
  <script>hljs.highlightAll();</script>
</body></html>`;

    default:
      return `<!DOCTYPE html>
<html><head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <style>body{margin:0;}pre{margin:0;min-height:100vh;}</style>
</head>
<body>
  <pre><code>${artifact.code.replace(/</g, '<')}</code></pre>
  <script>hljs.highlightAll();</script>
</body></html>`;
  }
}
