import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  Copy,
  Check,
  Download,
  ExternalLink,
  Eye,
  Code2,
  LayoutPanelLeft,
  Monitor,
  Smartphone,
  Tablet,
  AlertTriangle,
} from 'lucide-react';
import { useArtifactStore } from '@/stores/artifactStore';
import { prepareForIframe } from '@/lib/artifactParser';
import type { PanelMode } from '@/types/artifact.types';

// ── Lazy load Monaco ──
const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

// ── Device frame widths ──
type DeviceFrame = 'desktop' | 'tablet' | 'mobile';
const DEVICE_WIDTHS: Record<DeviceFrame, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

// ── Language → Monaco language map ──
const LANG_MAP: Record<string, string> = {
  html: 'html',
  react: 'javascript',
  svg: 'xml',
  markdown: 'markdown',
  javascript: 'javascript',
  css: 'css',
  typescript: 'typescript',
  jsx: 'javascript',
  tsx: 'typescript',
  python: 'python',
  json: 'json',
  sql: 'sql',
  bash: 'shell',
  shell: 'shell',
  yaml: 'yaml',
  xml: 'xml',
};

function getMonacoLang(language: string): string {
  return LANG_MAP[language.toLowerCase()] || 'plaintext';
}

// ── Type icon/color map (shared with badge) ──
const TYPE_META: Record<string, { color: string; label: string }> = {
  html:       { color: '#f97316', label: 'HTML' },
  react:      { color: '#61dafb', label: 'React' },
  svg:        { color: '#a855f7', label: 'SVG' },
  markdown:   { color: '#94a3b8', label: 'Markdown' },
  javascript: { color: '#facc15', label: 'JavaScript' },
  css:        { color: '#38bdf8', label: 'CSS' },
  unknown:    { color: '#64748b', label: 'Code' },
};

// ── Component ──
export const ArtifactPanel: React.FC = () => {
  const {
    isOpen,
    isFullscreen,
    mode,
    getActive,
    closePanel,
    setMode,
    toggleFullscreen,
  } = useArtifactStore();

  const artifact = getActive();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [device, setDevice] = useState<DeviceFrame>('desktop');
  const [iframeError, setIframeError] = useState<string | null>(null);

  // Reset device when artifact changes
  useEffect(() => {
    setDevice('desktop');
    setIframeError(null);
  }, [artifact?.id]);

  // Refresh iframe
  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setIframeError(null);
  }, []);

  // Copy code
  const handleCopy = useCallback(() => {
    if (!artifact) return;
    navigator.clipboard.writeText(artifact.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [artifact]);

  // Download
  const handleDownload = useCallback(() => {
    if (!artifact) return;
    const ext = artifact.language || 'txt';
    const blob = new Blob([artifact.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [artifact]);

  // Open in new tab
  const handleOpenExternal = useCallback(() => {
    if (!artifact) return;
    const html = prepareForIframe(artifact);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }, [artifact]);

  // Build iframe srcdoc
  const srcdoc = artifact ? prepareForIframe(artifact) : '';

  // Monaco language
  const monacoLang = artifact ? getMonacoLang(artifact.language) : 'plaintext';

  // Meta
  const meta = artifact ? TYPE_META[artifact.type] ?? TYPE_META.unknown : null;

  // ── Panel variants for framer-motion ──
  const panelVariants = {
    closed: { width: 0, opacity: 0, x: 20 },
    open: { width: 'auto', opacity: 1, x: 0 },
  };

  const fullscreenVariants = {
    closed: { opacity: 0, scale: 0.98 },
    open: { opacity: 1, scale: 1 },
  };

  // ── Render toolbar ──
  const renderToolbar = () => (
    <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.07] bg-white/[0.02] flex-shrink-0">
      {/* Left: title + type */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {meta && (
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: meta.color }}
          />
        )}
        <span className="text-[13px] font-medium text-foreground/80 truncate">
          {artifact?.title ?? 'Artifact'}
        </span>
        {meta && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
            style={{
              color: meta.color,
              backgroundColor: `${meta.color}18`,
            }}
          >
            {meta.label}
            {artifact && artifact.version > 1 ? ` v${artifact.version}` : ''}
          </span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* Mode toggle */}
        <div className="flex items-center gap-0.5 mr-1 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          {(['preview', 'split', 'code'] as PanelMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`p-1 rounded-md transition-all ${
                mode === m
                  ? 'bg-white/[0.1] text-foreground/80'
                  : 'text-foreground/30 hover:text-foreground/60'
              }`}
              title={
                m === 'preview'
                  ? 'Aperçu'
                  : m === 'split'
                  ? 'Divisé'
                  : 'Code'
              }
            >
              {m === 'preview' ? (
                <Eye size={13} />
              ) : m === 'split' ? (
                <LayoutPanelLeft size={13} />
              ) : (
                <Code2 size={13} />
              )}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-white/[0.08] mx-0.5" />

        {/* Device switcher (preview/split only) */}
        {(mode === 'preview' || mode === 'split') && (
          <>
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06] mr-1">
              {(['desktop', 'tablet', 'mobile'] as DeviceFrame[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDevice(d)}
                  className={`p-1 rounded-md transition-all ${
                    device === d
                      ? 'bg-white/[0.1] text-foreground/80'
                      : 'text-foreground/30 hover:text-foreground/60'
                  }`}
                >
                  {d === 'desktop' ? (
                    <Monitor size={12} />
                  ) : d === 'tablet' ? (
                    <Tablet size={12} />
                  ) : (
                    <Smartphone size={12} />
                  )}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-white/[0.08] mx-0.5" />
          </>
        )}

        {/* Action buttons */}
        <button
          onClick={refresh}
          className="p-1.5 rounded-md text-foreground/30 hover:text-foreground/60 hover:bg-white/[0.06] transition-all"
          title="Rafraîchir"
        >
          <RefreshCw size={13} />
        </button>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md text-foreground/30 hover:text-foreground/60 hover:bg-white/[0.06] transition-all"
          title="Copier le code"
        >
          {copied ? (
            <Check size={13} className="text-emerald-400" />
          ) : (
            <Copy size={13} />
          )}
        </button>
        <button
          onClick={handleDownload}
          className="p-1.5 rounded-md text-foreground/30 hover:text-foreground/60 hover:bg-white/[0.06] transition-all"
          title="Télécharger"
        >
          <Download size={13} />
        </button>
        <button
          onClick={handleOpenExternal}
          className="p-1.5 rounded-md text-foreground/30 hover:text-foreground/60 hover:bg-white/[0.06] transition-all"
          title="Ouvrir dans un nouvel onglet"
        >
          <ExternalLink size={13} />
        </button>

        <div className="w-px h-4 bg-white/[0.08] mx-0.5" />

        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-md text-foreground/30 hover:text-foreground/60 hover:bg-white/[0.06] transition-all"
          title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        <button
          onClick={closePanel}
          className="p-1.5 rounded-md text-foreground/30 hover:text-foreground/80 hover:bg-white/[0.06] transition-all"
          title="Fermer"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );

  // ── Render iframe preview ──
  const renderPreview = () => {
    if (!artifact) return null;

    return (
      <div
        className="flex-1 overflow-auto bg-[hsl(0,0%,8%)] flex items-start justify-center p-2"
      >
        {iframeError ? (
          <div className="flex flex-col items-center justify-center gap-3 text-foreground/40 p-8">
            <AlertTriangle size={24} />
            <p className="text-sm">{iframeError}</p>
            <button
              onClick={refresh}
              className="text-xs text-foreground/50 hover:text-foreground/80 underline underline-offset-2"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <div
            className="bg-white shadow-[0_8px_40px_rgba(0,0,0,0.4)] transition-all duration-300 flex-shrink-0 overflow-hidden"
            style={{
              width: DEVICE_WIDTHS[device],
              maxWidth: '100%',
              height: '100%',
              minHeight: '300px',
              borderRadius: device !== 'desktop' ? '12px' : '0',
            }}
          >
            <iframe
              key={refreshKey}
              ref={iframeRef}
              srcDoc={srcdoc}
              sandbox="allow-scripts allow-forms allow-modals"
              className="w-full h-full border-0"
              title={artifact.title}
              onError={() => setIframeError("Erreur de chargement de l'aperçu")}
            />
          </div>
        )}
      </div>
    );
  };

  // ── Render Monaco editor ──
  const renderEditor = () => {
    if (!artifact) return null;

    return (
      <div className="flex-1 overflow-hidden">
        <React.Suspense
          fallback={
            <div className="flex items-center justify-center h-full text-foreground/30 text-sm">
              Chargement de l'éditeur…
            </div>
          }
        >
          <MonacoEditor
            key={`${artifact.id}-${artifact.version}`}
            language={monacoLang}
            value={artifact.code}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 12 },
              renderWhitespace: 'selection',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}
            height="100%"
          />
        </React.Suspense>
      </div>
    );
  };

  // ── Render content based on mode ──
  const renderContent = () => {
    if (!artifact) return null;

    switch (mode) {
      case 'preview':
        return renderPreview();
      case 'code':
        return renderEditor();
      case 'split':
        return (
          <div className="flex-1 flex flex-col md:flex-row">
            <div className="flex-1 min-h-[200px] md:min-h-0 md:w-1/2 border-b md:border-b-0 md:border-r border-white/[0.07]">
              {renderPreview()}
            </div>
            <div className="flex-1 min-h-[200px] md:min-h-0 md:w-1/2">
              {renderEditor()}
            </div>
          </div>
        );
    }
  };

  // ── Empty state ──
  if (!artifact) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={panelVariants}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="h-full border-l border-white/[0.07] bg-[hsl(0,0%,10%)] flex flex-col overflow-hidden"
            style={{ width: 320, minWidth: 320 }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.07]">
              <span className="text-[13px] font-medium text-foreground/50">
                Artifact
              </span>
              <button
                onClick={closePanel}
                className="p-1.5 rounded-md text-foreground/30 hover:text-foreground/80 hover:bg-white/[0.06] transition-all"
              >
                <X size={13} />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center text-foreground/20 text-sm px-6 text-center">
              <p>Sélectionnez un artifact pour voir l'aperçu</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ── Fullscreen mode ──
  if (isFullscreen) {
    return (
      <AnimatePresence>
        <motion.div
          initial="closed"
          animate="open"
          exit="closed"
          variants={fullscreenVariants}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="fixed inset-0 z-50 bg-[hsl(0,0%,8%)] flex flex-col"
        >
          {renderToolbar()}
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Side panel mode ──
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial="closed"
          animate="open"
          exit="closed"
          variants={panelVariants}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="h-full border-l border-white/[0.07] bg-[hsl(0,0%,10%)] flex flex-col overflow-hidden"
          style={{ minWidth: 420, width: '100%' }}
        >
          {renderToolbar()}
          {renderContent()}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ArtifactPanel;
