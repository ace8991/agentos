import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Artifact } from '@/types/artifact.types';
import { prepareForIframe } from '@/lib/artifactDetector';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ArtifactPreviewProps {
  artifact: Artifact;
  refreshKey?: number;
}

export const ArtifactPreview: React.FC<ArtifactPreviewProps> = ({
  artifact,
  refreshKey = 0,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadPreview = useCallback(() => {
    if (!iframeRef.current) return;

    setIsLoading(true);
    setHasError(false);

    try {
      const htmlContent = prepareForIframe(artifact);
      iframeRef.current.srcdoc = htmlContent;
    } catch (err) {
      setHasError(true);
      setErrorMessage(String(err));
      setIsLoading(false);
    }
  }, [artifact, refreshKey]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // Écoute les messages d'erreur venant de l'iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'artifact-error') {
        setHasError(true);
        setErrorMessage(event.data.message);
        setIsLoading(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'rgba(0,0,0,0.3)',
              zIndex: 10,
              color: 'rgba(255,255,255,0.5)',
              fontSize: '13px',
            }}
          >
            <Loader2 size={20} className="animate-spin" />
            <span>Rendu en cours...</span>
          </motion.div>
        )}
        {hasError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'rgba(0,0,0,0.3)',
              zIndex: 10,
              color: '#f87171',
              fontSize: '13px',
            }}
          >
            <AlertTriangle size={20} />
            <span>Erreur de rendu</span>
            <code style={{ fontSize: '11px', opacity: 0.7, maxWidth: '80%', textAlign: 'center' }}>
              {errorMessage}
            </code>
          </motion.div>
        )}
      </AnimatePresence>

      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-forms allow-modals allow-popups"
        onLoad={() => setIsLoading(false)}
        onError={() => { setHasError(true); setIsLoading(false); }}
        title={artifact.title}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: '#fff',
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.2s',
        }}
      />
    </div>
  );
};
