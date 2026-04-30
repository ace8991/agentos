import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Editor } from '@monaco-editor/react';
import { useArtifactStore } from '@/stores/artifactStore';
import { Code, Eye, Maximize2, Minimize2, X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useState } from 'react';

export default function ArtifactPanel() {
  const { artifacts, activeArtifactId, panelState, viewMode, setViewMode, setPanelState, closePanel } = useArtifactStore();
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeArtifact = activeArtifactId ? artifacts[activeArtifactId] : null;

  useEffect(() => {
    // If the active artifact changes, or we switch to preview mode, reload the iframe content
    if (viewMode === 'preview' && activeArtifact && iframeRef.current) {
      const htmlContent = activeArtifact.language === 'html' ? activeArtifact.content : `
        <!DOCTYPE html>
        <html>
        <head>
          <style>body { font-family: system-ui, sans-serif; padding: 2rem; color: #333; }</style>
        </head>
        <body>
          <h3>Preview not available</h3>
          <p>This artifact cannot be previewed. Please switch to the Code view.</p>
        </body>
        </html>
      `;
      iframeRef.current.srcdoc = htmlContent;
    }
  }, [activeArtifact, viewMode]);

  if (!activeArtifact || panelState === 'hidden') return null;

  const isFullscreen = panelState === 'fullscreen';

  const handleCopy = () => {
    navigator.clipboard.writeText(activeArtifact.content);
    setCopied(true);
    toast.success('Code copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const getMonacoLanguage = (lang: string) => {
    switch (lang) {
      case 'html': return 'html';
      case 'javascript': return 'javascript';
      case 'typescript': return 'typescript';
      case 'react': return 'javascript'; // Monaco handles JSX in JS
      case 'css': return 'css';
      case 'json': return 'json';
      case 'python': return 'python';
      default: return 'plaintext';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: isFullscreen ? '100vw' : '45vw', opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`flex flex-col border-l border-white/10 bg-[#1e1e1e] shadow-2xl z-40 ${
          isFullscreen ? 'fixed inset-0 w-full h-full' : 'h-full relative'
        }`}
      >
        {/* Header Toolbar */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-black/40 px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="truncate font-medium text-sm text-white/90">
              {activeArtifact.title}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <div className="flex items-center rounded-md border border-white/10 bg-black/20 p-0.5 mr-2">
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-3 text-xs ${viewMode === 'preview' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'}`}
                onClick={() => setViewMode('preview')}
                disabled={activeArtifact.type !== 'website'}
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Preview
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-3 text-xs ${viewMode === 'code' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'}`}
                onClick={() => setViewMode('code')}
              >
                <Code className="mr-1.5 h-3.5 w-3.5" />
                Code
              </Button>
            </div>

            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-white/70 hover:text-white"
              onClick={() => setPanelState(isFullscreen ? 'split' : 'fullscreen')}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white" onClick={closePanel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative bg-white">
          {viewMode === 'preview' && activeArtifact.type === 'website' ? (
            <iframe
              ref={iframeRef}
              title="Artifact Preview"
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          ) : (
            <Editor
              height="100%"
              theme="vs-dark"
              language={getMonacoLanguage(activeArtifact.language)}
              value={activeArtifact.content}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                wordWrap: 'on',
                padding: { top: 16 }
              }}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
