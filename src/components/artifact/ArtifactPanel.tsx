import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelResizeHandle, Panel, PanelGroup } from 'react-resizable-panels';
import {
  Eye, Code2, Columns2, Copy, RefreshCw,
  Maximize2, Minimize2, X, Check, Download,
} from 'lucide-react';
import { useArtifactStore } from '@/stores/artifactStore';
import { ArtifactPreview } from './ArtifactPreview';
import { ArtifactCodeEditor } from './ArtifactCodeEditor';
import { PanelMode } from '@/types/artifact.types';

const ARTIFACT_TYPE_ICONS: Record<string, string> = {
  html: '🌐',
  react: '⚛️',
  svg: '🎨',
  markdown: '📄',
  javascript: '⚡',
  css: '🎨',
  python: '🐍',
  unknown: '💻',
};

/* ── Styles inline ── */

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 40,
  } as React.CSSProperties,

  panel: (fullscreen: boolean): React.CSSProperties => ({
    position: fullscreen ? 'fixed' : 'relative',
    inset: fullscreen ? 0 : undefined,
    zIndex: fullscreen ? 50 : undefined,
    display: 'flex',
    flexDirection: 'column',
    background: '#1a1a2e',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    overflow: 'hidden',
    height: fullscreen ? '100vh' : '100%',
    width: fullscreen ? '100vw' : '100%',
  }),

  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
    flexShrink: 0,
    gap: '8px',
  } as React.CSSProperties,

  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
    flex: 1,
  } as React.CSSProperties,

  toolbarIcon: {
    fontSize: '18px',
    lineHeight: 1,
  } as React.CSSProperties,

  toolbarMeta: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  } as React.CSSProperties,

  toolbarTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.85)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,

  toolbarType: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  versionBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 600,
    background: 'rgba(99,102,241,0.15)',
    color: '#818cf8',
  } as React.CSSProperties,

  toggleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    padding: '2px',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.04)',
  } as React.CSSProperties,

  toggleBtn: (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
    color: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    transition: 'all 0.15s',
  }),

  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    flexShrink: 0,
  } as React.CSSProperties,

  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  } as React.CSSProperties,

  divider: {
    width: '1px',
    height: '16px',
    background: 'rgba(255,255,255,0.08)',
    margin: '0 4px',
  } as React.CSSProperties,

  content: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  } as React.CSSProperties,

  resizeHandle: {
    width: '4px',
    background: 'rgba(255,255,255,0.06)',
    cursor: 'col-resize',
    transition: 'background 0.15s',
  } as React.CSSProperties,
};

export const ArtifactPanel: React.FC = () => {
  const {
    isPanelOpen,
    isPanelFullscreen,
    panelMode,
    getActiveArtifact,
    updateArtifact,
    setPanelMode,
    closePanel,
    toggleFullscreen,
  } = useArtifactStore();
  const artifact = getActiveArtifact();
  const [refreshKey, setRefreshKey] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!isPanelOpen || !artifact) return null;

  const handleCodeChange = (code: string) => {
    updateArtifact(artifact.id, { code });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const extensions: Record<string, string> = {
      html: 'html', react: 'jsx', svg: 'svg',
      markdown: 'md', javascript: 'js', css: 'css', python: 'py',
    };
    const ext = extensions[artifact.type] || 'txt';
    const blob = new Blob([artifact.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, '_').toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderContent = () => {
    switch (panelMode) {
      case 'preview':
        return <ArtifactPreview artifact={artifact} refreshKey={refreshKey} />;
      case 'code':
        return <ArtifactCodeEditor artifact={artifact} onChange={handleCodeChange} />;
      case 'split':
        return (
          <PanelGroup direction="horizontal">
            <Panel defaultSize={50} minSize={20}>
              <ArtifactPreview artifact={artifact} refreshKey={refreshKey} />
            </Panel>
            <PanelResizeHandle
              style={styles.resizeHandle}
              onMouseEnter={(e) => { (e.currentTarget as unknown as HTMLElement).style.background = 'rgba(99,102,241,0.3)'; }}
              onMouseLeave={(e) => { (e.currentTarget as unknown as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
            />
            <Panel defaultSize={50} minSize={20}>
              <ArtifactCodeEditor artifact={artifact} onChange={handleCodeChange} />
            </Panel>
          </PanelGroup>
        );
    }
  };

  return (
    <AnimatePresence>
      {isPanelFullscreen && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={styles.overlay}
          onClick={closePanel}
        />
      )}
      <motion.div
        key="panel"
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={styles.panel(isPanelFullscreen)}
      >
        {/* Toolbar */}
        <div style={styles.toolbar}>
          {/* Left: Title + Type */}
          <div style={styles.toolbarLeft}>
            <span style={styles.toolbarIcon}>
              {ARTIFACT_TYPE_ICONS[artifact.type] || '💻'}
            </span>
            <div style={styles.toolbarMeta}>
              <span style={styles.toolbarTitle}>{artifact.title}</span>
              <span style={styles.toolbarType}>{artifact.language.toUpperCase()}</span>
            </div>
            {artifact.version > 1 && (
              <motion.span
                style={styles.versionBadge}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                key={artifact.version}
              >
                v{artifact.version}
              </motion.span>
            )}
          </div>

          {/* Center: View Mode Toggle */}
          <div style={styles.toggleGroup}>
            {([
              { mode: 'preview' as PanelMode, icon: <Eye size={14} />, label: 'Aperçu' },
              { mode: 'split' as PanelMode, icon: <Columns2 size={14} />, label: 'Split' },
              { mode: 'code' as PanelMode, icon: <Code2 size={14} />, label: 'Code' },
            ] as const).map(({ mode, icon, label }) => (
              <button
                key={mode}
                style={styles.toggleBtn(panelMode === mode)}
                onClick={() => setPanelMode(mode)}
                title={label}
                onMouseEnter={(e) => {
                  if (panelMode !== mode) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (panelMode !== mode) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }
                }}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Right: Actions */}
          <div style={styles.actions}>
            <button
              style={styles.actionBtn}
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Rafraîchir"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <RefreshCw size={14} />
            </button>
            <button
              style={styles.actionBtn}
              onClick={handleDownload}
              title="Télécharger"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Download size={14} />
            </button>
            <button
              style={styles.actionBtn}
              onClick={handleCopy}
              title="Copier le code"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Check size={14} style={{ color: '#34d399' }} />
                  </motion.span>
                ) : (
                  <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Copy size={14} />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <button
              style={styles.actionBtn}
              onClick={toggleFullscreen}
              title="Plein écran"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {isPanelFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <div style={styles.divider} />
            <button
              style={{
                ...styles.actionBtn,
                color: 'rgba(255,255,255,0.4)',
              }}
              onClick={closePanel}
              title="Fermer"
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={styles.content}>
          {renderContent()}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
