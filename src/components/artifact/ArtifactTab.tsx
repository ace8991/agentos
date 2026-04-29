import React from 'react';
import { motion } from 'framer-motion';
import { Code2, Eye } from 'lucide-react';
import { Artifact } from '@/types/artifact.types';
import { useArtifactStore } from '@/stores/artifactStore';

interface ArtifactTabProps {
  artifact: Artifact;
}

const TYPE_COLORS: Record<string, string> = {
  html: '#f97316',
  react: '#61dafb',
  svg: '#a855f7',
  markdown: '#6b7280',
  javascript: '#eab308',
  css: '#06b6d4',
};

export const ArtifactTab: React.FC<ArtifactTabProps> = ({ artifact }) => {
  const { openPanel } = useArtifactStore();
  const color = TYPE_COLORS[artifact.type] || '#6b7280';

  return (
    <motion.button
      className="artifact-tab"
      onClick={() => openPanel(artifact.id)}
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
    >
      {/* Icon */}
      <div className="artifact-tab__icon" style={{ background: `${color}20`, color }}>
        <Code2 size={16} />
      </div>

      {/* Meta */}
      <div className="artifact-tab__meta">
        <span className="artifact-tab__title">{artifact.title}</span>
        <span className="artifact-tab__lang" style={{ color }}>
          {artifact.language.toUpperCase()}
        </span>
      </div>

      {/* Preview hint */}
      <div className="artifact-tab__preview-hint">
        <Eye size={12} />
        <span>Ouvrir l'aperçu</span>
      </div>
    </motion.button>
  );
};
