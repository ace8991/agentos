import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelResizeHandle, Panel, PanelGroup } from 'react-resizable-panels';
import { useArtifactStore } from '@/stores/artifactStore';
import { ArtifactToolbar } from './ArtifactToolbar';
import { ArtifactPreview } from './ArtifactPreview';
import { ArtifactCodeEditor } from './ArtifactCodeEditor';

export const ArtifactPanel: React.FC = () => {
  const { isPanelOpen, isPanelFullscreen, panelMode, getActiveArtifact, updateArtifact } = useArtifactStore();
  const artifact = getActiveArtifact();
  const [refreshKey, setRefreshKey] = useState(0);

  if (!isPanelOpen || !artifact) return null;

  const handleCodeChange = (code: string) => {
    updateArtifact(artifact.id, { code });
  };

  return (
    <AnimatePresence>
      <motion.div
        className={`artifact-panel ${isPanelFullscreen ? 'artifact-panel--fullscreen' : ''}`}
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Toolbar */}
        <ArtifactToolbar
          artifact={artifact}
          onRefresh={() => setRefreshKey((k) => k + 1)}
        />

        {/* Content Area */}
        <div className="artifact-panel__content">
          {panelMode === 'preview' && (
            <ArtifactPreview artifact={artifact} refreshKey={refreshKey} />
          )}

          {panelMode === 'code' && (
            <ArtifactCodeEditor artifact={artifact} onChange={handleCodeChange} />
          )}

          {panelMode === 'split' && (
            <PanelGroup direction="horizontal">
              <Panel defaultSize={50} minSize={20}>
                <ArtifactPreview artifact={artifact} refreshKey={refreshKey} />
              </Panel>
              <PanelResizeHandle className="artifact-panel__resize-handle" />
              <Panel defaultSize={50} minSize={20}>
                <ArtifactCodeEditor artifact={artifact} onChange={handleCodeChange} />
              </Panel>
            </PanelGroup>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
