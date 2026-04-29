import React, { useState } from 'react';
import {
  Eye, Code2, Columns2, Copy, RefreshCw,
  Maximize2, Minimize2, X, Check, Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Artifact } from '@/types/artifact.types';
import { useArtifactStore } from '@/stores/artifactStore';

interface ArtifactToolbarProps {
  artifact: Artifact;
  onRefresh: () => void;
}

const ARTIFACT_TYPE_ICONS: Record<string, string> = {
  html: '🌐',
  react: '⚛️',
  svg: '🎨',
  markdown: '📄',
  javascript: '⚡',
  css: '🎨',
  unknown: '💻',
};

export const ArtifactToolbar: React.FC<ArtifactToolbarProps> = ({
  artifact,
  onRefresh,
}) => {
  const { panelMode, isPanelFullscreen, setPanelMode, closePanel, toggleFullscreen } = useArtifactStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const extensions: Record<string, string> = {
      html: 'html', react: 'jsx', svg: 'svg',
      markdown: 'md', javascript: 'js', css: 'css',
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

  return (
    <div className="artifact-toolbar">
      {/* Left: Title + Type */}
      <div className="artifact-toolbar__left">
        <span className="artifact-toolbar__icon">
          {ARTIFACT_TYPE_ICONS[artifact.type] || '💻'}
        </span>
        <div className="artifact-toolbar__meta">
          <span className="artifact-toolbar__title">{artifact.title}</span>
          <span className="artifact-toolbar__type">{artifact.language.toUpperCase()}</span>
        </div>
        {artifact.version > 1 && (
          <motion.span
            className="artifact-toolbar__version"
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            key={artifact.version}
          >
            v{artifact.version}
          </motion.span>
        )}
      </div>

      {/* Center: View Mode Toggle */}
      <div className="artifact-toolbar__toggle-group">
        {[
          { mode: 'preview' as const, icon: <Eye size={14} />, label: 'Aperçu' },
          { mode: 'split' as const, icon: <Columns2 size={14} />, label: 'Split' },
          { mode: 'code' as const, icon: <Code2 size={14} />, label: 'Code' },
        ].map(({ mode, icon, label }) => (
          <button
            key={mode}
            className={`artifact-toolbar__toggle ${panelMode === mode ? 'active' : ''}`}
            onClick={() => setPanelMode(mode)}
            title={label}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Right: Actions */}
      <div className="artifact-toolbar__actions">
        <button className="artifact-toolbar__btn" onClick={onRefresh} title="Rafraîchir">
          <RefreshCw size={14} />
        </button>
        <button className="artifact-toolbar__btn" onClick={handleDownload} title="Télécharger">
          <Download size={14} />
        </button>
        <button className="artifact-toolbar__btn" onClick={handleCopy} title="Copier le code">
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Check size={14} className="text-green-400" />
              </motion.span>
            ) : (
              <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Copy size={14} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <button className="artifact-toolbar__btn" onClick={toggleFullscreen} title="Plein écran">
          {isPanelFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <div className="artifact-toolbar__divider" />
        <button className="artifact-toolbar__btn artifact-toolbar__btn--close" onClick={closePanel} title="Fermer">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
