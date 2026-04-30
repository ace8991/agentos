import React from 'react';
import { motion } from 'framer-motion';
import { Eye, Code2, Globe, FileText, FileCode } from 'lucide-react';
import { Artifact } from '@/types/artifact.types';
import { useArtifactStore } from '@/stores/artifactStore';

const META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  html:       { icon: <Globe size={15} />,    color: '#f97316', label: 'HTML' },
  react:      { icon: <FileCode size={15} />, color: '#61dafb', label: 'React' },
  svg:        { icon: <FileCode size={15} />, color: '#a855f7', label: 'SVG' },
  markdown:   { icon: <FileText size={15} />, color: '#94a3b8', label: 'Markdown' },
  javascript: { icon: <Code2 size={15} />,    color: '#facc15', label: 'JavaScript' },
  css:        { icon: <Code2 size={15} />,    color: '#38bdf8', label: 'CSS' },
  unknown:    { icon: <Code2 size={15} />,    color: '#64748b', label: 'Code' },
};

interface ArtifactBadgeProps {
  artifact: Artifact;
}

export const ArtifactBadge: React.FC<ArtifactBadgeProps> = ({ artifact }) => {
  const { openPanel } = useArtifactStore();
  const meta = META[artifact.type] ?? META.unknown;

  return (
    <motion.button
      onClick={() => openPanel(artifact.id)}
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', marginTop: 8, width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 10, cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = 'rgba(255,255,255,0.07)';
        el.style.borderColor = 'rgba(255,255,255,0.16)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = 'rgba(255,255,255,0.04)';
        el.style.borderColor = 'rgba(255,255,255,0.09)';
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${meta.color}18`, color: meta.color,
      }}>
        {meta.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500, color: '#e5e5e5',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {artifact.title}
        </div>
        <div style={{ fontSize: 10, color: meta.color, fontFamily: 'monospace', marginTop: 1 }}>
          {meta.label}{artifact.version > 1 ? ` · v${artifact.version}` : ''}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#555', flexShrink: 0 }}>
        <Eye size={12} />
        <span>Aperçu</span>
      </div>
    </motion.button>
  );
};
