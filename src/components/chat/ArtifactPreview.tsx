import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Maximize2, Minimize2, RefreshCw, AlertTriangle, X,
  ExternalLink, Code, Eye,
} from 'lucide-react';
import type { Artifact } from '@/lib/artifacts';

const BABEL_CDN = 'https://unpkg.com/@babel/standalone@7.24.7/babel.min.js';

const buildSandboxHtml = (artifact: Artifact): string => {
  const isReact = artifact.language && ['jsx', 'tsx', 'javascript', 'typescript'].includes(artifact.language.toLowerCase())
    && /import\s+React|from\s+['"]react['"]|useState|useEffect|<\w+[A-Z]/.test(artifact.content);

  if (!isReact) {
    // Pure HTML artifact
    const content = artifact.content.trim();
    if (/<html|<!doctype/i.test(content)) return content;
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${artifact.title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root{color-scheme:light dark}
    body{margin:0;min-height:100vh;font-family:Inter,system-ui,sans-serif;background:#0f172a;color:#f1f5f9}
  </style>
</head>
<body>${content}</body>
</html>`;
  }

  // React artifact — transpile JSX via Babel
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${artifact.title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="${BABEL_CDN}"></script>
  <script src="https://unpkg.com/lucide-react@0.344.0/dist/umd/lucide-react.min.js" crossorigin></script>
  <script src="https://unpkg.com/recharts@2.12.7/umd/Recharts.min.js" crossorigin></script>
  <style>
    :root{color-scheme:light dark}
    body{margin:0;min-height:100vh;font-family:Inter,system-ui,sans-serif;background:#0f172a;color:#f1f5f9}
    #root{min-height:100vh}
    #error-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);color:#f87171;padding:2rem;font-family:monospace;font-size:13px;white-space:pre-wrap;z-index:9999;overflow:auto}
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="error-overlay"></div>
  <script type="text/babel" data-type="module">
    const { useState, useEffect, useRef, useCallback, useMemo, useReducer, useContext, createContext, Fragment } = React;
    // Make lucide icons available
    const lucide = window.lucideReact || {};

    try {
      ${artifact.content}

      // Find default export or first component
      const _exports = typeof App !== 'undefined' ? App
        : typeof Default !== 'undefined' ? Default
        : typeof Component !== 'undefined' ? Component
        : null;

      if (_exports) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(_exports));
      }
    } catch(e) {
      document.getElementById('error-overlay').style.display = 'block';
      document.getElementById('error-overlay').textContent = 'Runtime Error:\\n' + e.message + '\\n\\n' + (e.stack || '');
    }
  </script>
  <script>
    window.addEventListener('error', function(e) {
      var el = document.getElementById('error-overlay');
      if (el) { el.style.display='block'; el.textContent = 'Error:\\n' + e.message + (e.filename ? '\\n' + e.filename + ':' + e.lineno : ''); }
    });
  </script>
</body>
</html>`;
};

interface ArtifactPreviewProps {
  artifact: Artifact;
  className?: string;
}

const ArtifactPreview = ({ artifact, className = '' }: ArtifactPreviewProps) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcDoc = useCallback(() => {
    try {
      setError(null);
      return buildSandboxHtml(artifact);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Build error');
      return '';
    }
  }, [artifact]);

  const html = srcDoc();

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'artifact-error') {
        setError(e.data.message);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const containerClass = fullscreen
    ? 'fixed inset-0 z-50 bg-background flex flex-col'
    : `relative ${className}`;

  return (
    <div className={containerClass}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.07] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-foreground/40 font-mono">
            {showCode ? 'Source' : 'Preview'}
          </span>
          {error && (
            <span className="flex items-center gap-1 text-[11px] text-red-400">
              <AlertTriangle size={10} /> Error
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowCode(!showCode)}
            className="p-1 rounded text-foreground/30 hover:text-foreground/60 transition-colors"
            title={showCode ? 'Preview' : 'View source'}>
            {showCode ? <Eye size={12} /> : <Code size={12} />}
          </button>
          <button onClick={() => setKey(k => k + 1)}
            className="p-1 rounded text-foreground/30 hover:text-foreground/60 transition-colors"
            title="Reload">
            <RefreshCw size={12} />
          </button>
          <button onClick={() => {
            const w = window.open('', '_blank');
            if (w) { w.document.write(html); w.document.close(); }
          }}
            className="p-1 rounded text-foreground/30 hover:text-foreground/60 transition-colors"
            title="Open in new tab">
            <ExternalLink size={12} />
          </button>
          <button onClick={() => setFullscreen(!fullscreen)}
            className="p-1 rounded text-foreground/30 hover:text-foreground/60 transition-colors"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          {fullscreen && (
            <button onClick={() => setFullscreen(false)}
              className="p-1 rounded text-foreground/30 hover:text-foreground/60 transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 ${fullscreen ? '' : 'h-72'} overflow-hidden`}>
        {showCode ? (
          <pre className="p-3 text-[12px] font-mono text-foreground/70 leading-relaxed overflow-auto h-full whitespace-pre-wrap">
            {artifact.content}
          </pre>
        ) : error ? (
          <div className="p-4 text-[12px] font-mono text-red-400/80 whitespace-pre-wrap">
            {error}
          </div>
        ) : (
          <iframe
            key={key}
            ref={iframeRef}
            srcDoc={html}
            className="w-full h-full border-0 bg-white"
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            title={artifact.title}
          />
        )}
      </div>
    </div>
  );
};

export default ArtifactPreview;
