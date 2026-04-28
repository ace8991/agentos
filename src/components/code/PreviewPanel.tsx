import { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw, Maximize2, Minimize2, Monitor, AlertTriangle, ExternalLink, Smartphone, Tablet, Copy, Check } from 'lucide-react';

interface PreviewPanelProps {
  content: string;
  language: string;
  filePath?: string;
  onClose?: () => void;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';
const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

// ─── Babel transpiler (lazy-loaded) ─────────────────────────────────
const transpileReact = (code: string): string => {
  try {
    // @ts-expect-error - Babel is loaded dynamically
    if (!window.Babel) return '';
    // @ts-expect-error - Babel is loaded dynamically
    const result = window.Babel.transform(code, {
      presets: ['react'],
      plugins: [],
    });
    return result.code;
  } catch (e: any) {
    return `throw new Error(${JSON.stringify(e.message)})`;
  }
};

// ─── Build srcdoc HTML from file content ────────────────────────────
const buildSrcdoc = (content: string, lang: string): string => {
  if (lang === 'html') {
    // Inject base + meta if missing
    if (!content.includes('<!DOCTYPE') && !content.includes('<html')) {
      return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#fff;color:#111}</style></head><body>${content}</body></html>`;
    }
    return content;
  }

  if (lang === 'css') {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#fff;color:#111}
${content}
</style></head><body>
<h1 class="heading">Preview de la CSS</h1>
<p class="paragraph">Voici un aperçu de vos styles appliqués à du contenu type.</p>
<button class="button">Bouton</button>
<div class="card" style="margin-top:12px;padding:12px;border:1px solid #e5e7eb;border-radius:8px">
  <p class="card-text">Carte exemple</p>
</div>
</body></html>`;
  }

  if (lang === 'jsx' || lang === 'tsx') {
    const transpiled = transpileReact(content);
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#fff;color:#111}*{box-sizing:border-box}</style>
</head><body><div id="root"></div>
<script>
try {
${transpiled}
const rootEl = document.getElementById('root');
const root = ReactDOM.createRoot(rootEl);
// Try to render default export
const exported = typeof module !== 'undefined' && module.exports ? module.exports.default || module.exports : window.__lastExport;
if (exported && typeof exported === 'function') {
  root.render(React.createElement(exported));
} else {
  rootEl.innerHTML = '<div style="padding:16px;background:#fef3c7;border-radius:8px;font-size:14px">⚠️ Aucun composant React par défaut exporté trouvé.</div>';
}
} catch(e) {
  document.getElementById('root').innerHTML = '<div style="padding:16px;background:#fee2e2;border-radius:8px;font-size:13px;font-family:monospace"><b>Erreur de rendu:</b><br>' + e.message + '</div>';
}
</script>
</body></html>`;
  }

  if (lang === 'js' || lang === 'javascript' || lang === 'ts' || lang === 'typescript') {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#0f172a;color:#e2e8f0;font-size:13px}
.line{border-bottom:1px solid #1e293b;padding:4px 0;font-family:monospace;word-break:break-all}
.err{color:#f87171}.warn{color:#fbbf24}.info{color:#60a5fa}
</style></head><body>
<div id="output"></div>
<script>
const out = document.getElementById('output');
const log = (cls, ...args) => {
  const d = document.createElement('div');
  d.className = 'line ' + cls;
  d.textContent = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
  out.appendChild(d);
};
const _console = { log: (...a) => log('', ...a), error: (...a) => log('err', ...a), warn: (...a) => log('warn', ...a), info: (...a) => log('info', ...a) };
try {
  (function(console) {
${content}
  })(_console);
} catch(e) {
  log('err', '❌ ' + e.message);
}
</script></body></html>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:monospace;margin:0;padding:16px;background:#0f172a;color:#94a3b8;font-size:12px;white-space:pre-wrap;word-break:break-all}</style></head><body>${content.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</body></html>`;
};

const NEEDS_BABEL = new Set(['jsx', 'tsx']);

export const PreviewPanel = ({ content, language, filePath }: PreviewPanelProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0); // force reload
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [fullscreen, setFullscreen] = useState(false);
  const [babelReady, setBabelReady] = useState(!NEEDS_BABEL.has(language));
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load Babel lazily for JSX/TSX
  useEffect(() => {
    if (!NEEDS_BABEL.has(language)) { setBabelReady(true); return; }
    // @ts-expect-error - Babel is loaded dynamically
    if (window.Babel) { setBabelReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@babel/standalone/babel.min.js';
    script.onload = () => setBabelReady(true);
    document.head.appendChild(script);
    return () => { /* no cleanup needed */ };
  }, [language]);

  // Auto-refresh on content change (debounced)
  useEffect(() => {
    if (!babelReady) return;
    setLoading(true);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      setKey(k => k + 1);
      setLoading(false);
    }, 600);
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, [content, language, babelReady]);

  const refresh = useCallback(() => { setKey(k => k + 1); }, []);

  const openExternal = () => {
    const html = buildSrcdoc(content, language);
    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  const copyContent = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canPreview = ['html', 'css', 'js', 'javascript', 'ts', 'typescript', 'jsx', 'tsx'].includes(language);

  if (!canPreview) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[hsl(0,0%,10%)] text-muted-foreground gap-3 p-8">
        <Monitor size={32} className="opacity-30" />
        <p className="text-sm font-medium text-center">
          Aperçu non disponible pour <code className="bg-[hsl(0,0%,15%)] px-1.5 py-0.5 rounded text-xs font-mono">.{language}</code>
        </p>
        <p className="text-xs text-center max-w-[280px]">
          L'aperçu live supporte HTML, CSS, JavaScript, TypeScript et JSX/TSX.
        </p>
      </div>
    );
  }

  const srcdoc = buildSrcdoc(content, language);

  return (
    <div className={`flex flex-col bg-[hsl(0,0%,10%)] ${fullscreen ? 'fixed inset-0 z-50' : 'flex-1'}`}>
      {/* Preview toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[hsl(0,0%,17%)] bg-[hsl(0,0%,11%)] flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 h-2.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="bg-[hsl(0,0%,15%)] border border-[hsl(0,0%,20%)] rounded-md px-2.5 py-1 text-[11px] text-muted-foreground font-mono min-w-[160px] truncate">
            {filePath || 'Preview'}
          </div>
          {loading && <div className="w-3 h-3 border-t border-r border-[hsl(14,74%,52%)] rounded-full animate-spin" />}
        </div>

        <div className="flex items-center gap-1">
          {/* Device switcher */}
          {(['desktop', 'tablet', 'mobile'] as DeviceMode[]).map(d => (
            <button key={d} onClick={() => setDevice(d)}
              className={`p-1.5 rounded transition-colors ${device === d ? 'text-[hsl(14,74%,52%)]' : 'text-muted-foreground hover:text-foreground'}`}>
              {d === 'desktop' ? <Monitor size={12} /> : d === 'tablet' ? <Tablet size={12} /> : <Smartphone size={12} />}
            </button>
          ))}
          <div className="w-px h-4 bg-[hsl(0,0%,20%)] mx-0.5" />
          <button onClick={copyContent} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors" title="Copier HTML">
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          </button>
          <button onClick={refresh} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors" title="Rafraîchir">
            <RefreshCw size={12} />
          </button>
          <button onClick={openExternal} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors" title="Ouvrir dans un nouvel onglet">
            <ExternalLink size={12} />
          </button>
          <button onClick={() => setFullscreen(f => !f)} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors">
            {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* iframe container */}
      <div className="flex-1 overflow-auto bg-[hsl(0,0%,13%)] flex items-start justify-center p-3">
        {!babelReady && NEEDS_BABEL.has(language) ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs mt-8">
            <div className="w-4 h-4 border-t border-r border-primary rounded-full animate-spin" />
            Chargement du transpileur Babel…
          </div>
        ) : (
          <div
            className="bg-white shadow-[0_8px_40px_rgba(0,0,0,0.4)] transition-all duration-300 flex-shrink-0"
            style={{
              width: DEVICE_WIDTHS[device],
              maxWidth: '100%',
              height: '100%',
              minHeight: '400px',
              borderRadius: device !== 'desktop' ? '12px' : '0',
              overflow: 'hidden',
            }}
          >
            <iframe
              key={key}
              ref={iframeRef}
              srcDoc={srcdoc}
              sandbox="allow-scripts allow-same-origin"
              className="w-full h-full border-0"
              title="Live Preview"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;
