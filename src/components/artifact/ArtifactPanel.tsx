import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import {
  Eye, Code2, Columns2, Copy, RefreshCw,
  Maximize2, Minimize2, X, Check, Download, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useArtifactStore } from '@/stores/artifactStore';
import { prepareForIframe } from '@/lib/artifactParser';

const LANG_MAP: Record<string, string> = {
  html: 'html', react: 'javascript', jsx: 'javascript',
  svg: 'xml', markdown: 'markdown', javascript: 'javascript',
  js: 'javascript', css: 'css', ts: 'typescript',
};

const TYPE_ICONS: Record<string, string> = {
  html: '🌐', react: '⚛️', svg: '🎨',
  markdown: '📄', javascript: '⚡', css: '🎨', unknown: '💻',
};

export const ArtifactPanel: React.FC = () => {
  const {
    isOpen, isFullscreen, mode, artifacts, activeId,
    getActive, closePanel, setMode, toggleFullscreen, setActive,
  } = useArtifactStore();

  // ✅ L'artifact actif — UN SEUL affiché à la fois
  const artifact = getActive();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Liste des artifacts pour la navigation par tabs
  const artifactList = Object.values(artifacts);
  const activeIndex = artifactList.findIndex(a => a.id === activeId);

  // ✅ Recharge l'iframe UNIQUEMENT quand l'artifact actif change
  useEffect(() => {
    if (!iframeRef.current || !artifact) return;
    if (mode === 'code') return;
    setLoading(true);
    iframeRef.current.srcdoc = prepareForIframe(artifact);
  }, [artifact?.id, artifact?.version, refreshKey]);

  // ✅ Recharge aussi quand on switch de mode vers 'preview' ou 'split'
  useEffect(() => {
    if (!iframeRef.current || !artifact) return;
    if (mode === 'code') return;
    setLoading(true);
    iframeRef.current.srcdoc = prepareForIframe(artifact);
  }, [mode]);

  const handleCopy = async () => {
    if (!artifact) return;
    await navigator.clipboard.writeText(artifact.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!artifact) return;
    const blob = new Blob([artifact.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, '-').toLowerCase()}.${artifact.language}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const goToPrev = () => {
    if (activeIndex > 0) setActive(artifactList[activeIndex - 1].id);
  };

  const goToNext = () => {
    if (activeIndex < artifactList.length - 1) setActive(artifactList[activeIndex + 1].id);
  };

  // ✅ Ne rien rendre si pas d'artifact actif
  if (!isOpen || !artifact) return null;

  const panelStyle: React.CSSProperties = isFullscreen
    ? { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#0d0d0d' }
    : { display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0d0d', borderLeft: '1px solid rgba(255,255,255,0.07)' };

  const monacoLang = LANG_MAP[artifact.language] || LANG_MAP[artifact.type] || 'plaintext';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="artifact-panel"
        style={panelStyle}
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 32, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        {/* ── TABS (si plusieurs artifacts) ── */}
        {artifactList.length > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center',
            height: 36, padding: '0 8px', gap: 4,
            background: '#0a0a0a', borderBottom: '1px solid rgba(255,255,255,0.05)',
            overflowX: 'auto',
          }}>
            <button onClick={goToPrev} disabled={activeIndex === 0} style={{
              width: 24, height: 24, borderRadius: 4, border: 'none',
              background: 'transparent', color: activeIndex === 0 ? '#333' : '#666',
              cursor: activeIndex === 0 ? 'default' : 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ChevronLeft size={12} />
            </button>

            {artifactList.map((a) => (
              <button
                key={a.id}
                onClick={() => setActive(a.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '0 10px', height: 28, borderRadius: 6, border: 'none',
                  cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                  background: a.id === activeId ? 'rgba(255,255,255,0.07)' : 'transparent',
                  color: a.id === activeId ? '#e5e5e5' : '#555',
                  flexShrink: 0, whiteSpace: 'nowrap',
                  transition: 'background 0.12s, color 0.12s',
                  borderBottom: a.id === activeId ? '2px solid #f97316' : '2px solid transparent',
                }}
              >
                <span style={{ fontSize: 11 }}>{TYPE_ICONS[a.type] ?? '💻'}</span>
                {a.title.length > 16 ? a.title.slice(0, 16) + '…' : a.title}
              </button>
            ))}

            <button onClick={goToNext} disabled={activeIndex === artifactList.length - 1} style={{
              width: 24, height: 24, borderRadius: 4, border: 'none',
              background: 'transparent', color: activeIndex === artifactList.length - 1 ? '#333' : '#666',
              cursor: activeIndex === artifactList.length - 1 ? 'default' : 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ChevronRight size={12} />
            </button>
          </div>
        )}

        {/* ── TOOLBAR ── */}
        <div style={{
          display: 'flex', alignItems: 'center', height: 48,
          padding: '0 12px', gap: 8, flexShrink: 0,
          background: '#111111', borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICONS[artifact.type] ?? '💻'}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 500, color: '#e5e5e5',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {artifact.title}
              </div>
              <div style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>
                {artifact.language.toUpperCase()}{artifact.version > 1 ? ` · v${artifact.version}` : ''}
              </div>
            </div>
          </div>

          {/* Mode toggle */}
          <div style={{
            display: 'flex', background: '#1a1a1a', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.07)', padding: 3, gap: 2,
          }}>
            {([
              { m: 'preview' as const, icon: <Eye size={13} />, label: 'Aperçu' },
              { m: 'split' as const,   icon: <Columns2 size={13} />, label: 'Split' },
              { m: 'code' as const,    icon: <Code2 size={13} />, label: 'Code' },
            ]).map(({ m, icon, label }) => (
              <button key={m} onClick={() => setMode(m)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 6, fontSize: 12,
                cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                background: mode === m ? '#252525' : 'transparent',
                color: mode === m ? '#e5e5e5' : '#555',
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
                transition: 'all 0.12s',
              }}>
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 3 }}>
            {[
              { icon: <RefreshCw size={13} />, title: 'Rafraîchir', fn: () => setRefreshKey(k => k + 1) },
              { icon: <Download size={13} />, title: 'Télécharger', fn: handleDownload },
              { icon: copied ? <Check size={13} style={{ color: '#4ade80' }} /> : <Copy size={13} />, title: 'Copier', fn: handleCopy },
              { icon: isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />, title: 'Plein écran', fn: toggleFullscreen },
            ].map((btn, i) => (
              <button key={i} onClick={btn.fn} title={btn.title} style={{
                width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', color: '#555', fontFamily: 'inherit',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1e1e1e'; (e.currentTarget as HTMLButtonElement).style.color = '#ccc'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#555'; }}
              >
                {btn.icon}
              </button>
            ))}

            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.07)', margin: '0 3px', alignSelf: 'center' }} />

            <button onClick={closePanel} title="Fermer" style={{
              width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', color: '#555', fontFamily: 'inherit',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#555'; }}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* ── CONTENT : UN SEUL artifact rendu ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

          {/* Preview iframe */}
          {(mode === 'preview' || mode === 'split') && (
            <div style={{ flex: 1, position: 'relative', background: '#fff', overflow: 'hidden' }}>
              {loading && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: '#0d0d0d', color: '#444', fontSize: 13, zIndex: 1, gap: 8,
                }}>
                  <span style={{ fontSize: 16 }}>⟳</span>Rendu en cours...
                </div>
              )}
              <iframe
                ref={iframeRef}
                key={artifact.id}
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                style={{
                  width: '100%', height: '100%', border: 'none',
                  opacity: loading ? 0 : 1, transition: 'opacity 0.2s',
                }}
                onLoad={() => setLoading(false)}
                title={artifact.title}
              />
            </div>
          )}

          {mode === 'split' && (
            <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
          )}

          {/* Code editor */}
          {(mode === 'code' || mode === 'split') && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Editor
                key={artifact.id}
                height="100%"
                language={monacoLang}
                value={artifact.code}
                theme="vs-dark"
                options={{
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontLigatures: true,
                  lineHeight: 1.7,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  padding: { top: 16, bottom: 16 },
                  readOnly: true,
                  bracketPairColorization: { enabled: true },
                  tabSize: 2,
                }}
              />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ArtifactPanel;
