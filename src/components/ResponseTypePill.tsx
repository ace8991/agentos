import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Code2, FileText, BarChart2, Brain, Table, Terminal } from 'lucide-react';
import type { ResponseType } from '@/lib/intentEngine/types';

const RESPONSE_TYPE_META: Record<ResponseType, { icon: React.ReactNode; label: string; color: string }> = {
  text:          { icon: <FileText size={11} />,  label: 'Réponse',       color: '#64748b' },
  artifact_html: { icon: <Globe size={11} />,     label: 'Web App',       color: '#f97316' },
  artifact_react:{ icon: <Code2 size={11} />,     label: 'React',         color: '#61dafb' },
  artifact_svg:  { icon: <Code2 size={11} />,     label: 'SVG',           color: '#a855f7' },
  artifact_md:   { icon: <FileText size={11} />,  label: 'Document',      color: '#94a3b8' },
  artifact_js:   { icon: <Code2 size={11} />,     label: 'JavaScript',    color: '#facc15' },
  artifact_css:  { icon: <Code2 size={11} />,     label: 'CSS',           color: '#38bdf8' },
  chart:         { icon: <BarChart2 size={11} />, label: 'Graphique',     color: '#4ade80' },
  mindmap:       { icon: <Brain size={11} />,     label: 'Carte mentale', color: '#f43f5e' },
  table:         { icon: <Table size={11} />,     label: 'Tableau',       color: '#e2e8f0' },
  code_block:    { icon: <Code2 size={11} />,     label: 'Code',          color: '#6366f1' },
  tool_calls:    { icon: <Terminal size={11} />,  label: 'Exécution',     color: '#4ade80' },
  mixed:         { icon: <Globe size={11} />,     label: 'Mixte',         color: '#6366f1' },
};

interface ResponseTypePillProps {
  responseType: ResponseType;
  isVisible: boolean;
}

export const ResponseTypePill: React.FC<ResponseTypePillProps> = ({ responseType, isVisible }) => {
  const meta = RESPONSE_TYPE_META[responseType];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.9 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 8px', borderRadius: 20,
            background: `${meta.color}15`,
            border: `1px solid ${meta.color}30`,
            color: meta.color, fontSize: 11, fontWeight: 500,
          }}
        >
          {meta.icon}
          <span>{meta.label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
