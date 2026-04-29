import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Artifact } from '@/types/artifact.types';
import { prepareHtmlForPreview } from './ArtifactDetector';
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
      const htmlContent = prepareHtmlForPreview(artifact);
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
    <div className="artifact-preview">
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="artifact-preview__loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 size={20} className="animate-spin" />
            <span>Rendu en cours...</span>
          </motion.div>
        )}
        {hasError && (
          <motion.div
            className="artifact-preview__error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertTriangle size={20} />
            <span>Erreur de rendu</span>
            <code>{errorMessage}</code>
          </motion.div>
        )}
      </AnimatePresence>

      <iframe
        ref={iframeRef}
        className="artifact-preview__iframe"
        sandbox="allow-scripts allow-forms allow-modals allow-popups"
        onLoad={() => setIsLoading(false)}
        onError={() => { setHasError(true); setIsLoading(false); }}
        title={artifact.title}
        style={{ opacity: isLoading ? 0 : 1 }}
      />
    </div>
  );
};
