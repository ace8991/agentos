import React from 'react';
import { motion } from 'framer-motion';
import { Code2, Eye } from 'lucide-react';
import { Artifact } from '@/types/artifact.types';
import { useArtifactStore } from '@/stores/artifactStore';

interface ArtifactBadgeProps {
  artifact: Artifact;
}

const TYPE_COLORS: Record<string, string> = {
  html: '#f97316',
  react: '#61dafb',
  svg: '#a855f7',
  markdown: '#6b7280',
  javascript: '#eab308',
  css: '#06b6d4',
  python: '#3776ab',
};

const TYPE_ICONS: Record<string, string> = {
  html: '🌐',
  react: '⚛️',
  svg: '🖼️',
  markdown: '📝',
  javascript: '🟨',
  css: '🎨',
  python: '🐍',
  unknown: '📄',
};

export const ArtifactBadge: React.FC<ArtifactBadgeProps> = ({ artifact }) => {
  const { openPanel } = useArtifactStore();
  const color = TYPE_COLORS[artifact.type] || '#6b7280';
  const icon = TYPE_ICONS[artifact.type] || '📄';

  return (
    <motion.button
      onClick={() => openPanel(artifact.id)}
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: '16px', lineHeight: 1 }}>{icon}</span>

      {/* Meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.85)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {artifact.title}
        </div>
        <div style={{
          fontSize: '10px',
          fontWeight: 600,
          color,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {artifact.language.toUpperCase()}
          {artifact.version > 1 && (
            <span style={{ marginLeft: '6px', opacity: 0.5 }}>
              v{artifact.version}
            </span>
          )}
        </div>
      </div>

      {/* Preview hint */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.3)',
        whiteSpace: 'nowrap',
      }}>
        <Eye size={12} />
        <span>Aperçu</span>
      </div>
    </motion.button>
  );
};

export default ArtifactBadge;
