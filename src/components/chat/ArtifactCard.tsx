import { useState } from 'react';
import {
  FileText, Code, Image, Download, Copy, Check, Maximize2, Minimize2,
  ExternalLink, FileCode, FileSpreadsheet, Globe, Terminal as TerminalIcon,
  Eye, AppWindow, Presentation, FileArchive
} from 'lucide-react';
import {
  type Artifact,
  type ArtifactType,
  getArtifactMimeType,
  getArtifactPreviewHtml,
  languageLabels,
} from '@/lib/artifacts';

const artifactIcons: Record<ArtifactType, typeof FileText> = {
  code: Code,
  document: FileText,
  image: Image,
  html: Globe,
  csv: FileSpreadsheet,
  terminal: TerminalIcon,
  webpage: Globe,
  markdown: FileCode,
  slides: Presentation,
  app: AppWindow,
  pdf: FileArchive,
};

const artifactColors: Record<ArtifactType, string> = {
  code: 'border-primary/30 bg-primary/5',
  document: 'border-accent/30 bg-accent/5',
  image: 'border-secondary/30 bg-secondary/5',
  html: 'border-success/30 bg-success/5',
  csv: 'border-secondary/30 bg-secondary/5',
  terminal: 'border-muted-foreground/30 bg-muted',
  webpage: 'border-primary/30 bg-primary/5',
  markdown: 'border-accent/30 bg-accent/5',
  slides: 'border-fuchsia-300/30 bg-fuchsia-400/5',
  app: 'border-sky-300/30 bg-sky-400/5',
  pdf: 'border-amber-300/30 bg-amber-400/5',
};

interface ArtifactCardProps {
  artifact: Artifact;
}

const ArtifactCard = ({ artifact }: ArtifactCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const Icon = artifactIcons[artifact.type] || FileText;
  const borderColor = artifactColors[artifact.type] || 'border-border bg-muted/30';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext =
      artifact.filename?.split('.').pop() ||
      artifact.language ||
      (artifact.type === 'slides' ? 'md' : artifact.type === 'app' ? 'html' : artifact.type === 'csv' ? 'csv' : 'txt');
    const filename = artifact.filename || `${artifact.title.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
    const blob = new Blob([artifact.content], { type: getArtifactMimeType(artifact) });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxCollapsedLines = 12;
  const lines = artifact.content.split('\n');
  const isLong = lines.length > maxCollapsedLines;
  const displayContent = expanded ? artifact.content : lines.slice(0, maxCollapsedLines).join('\n');

  return (
    <div className={`mt-3 rounded-xl border ${borderColor} overflow-hidden transition-all`}>
      {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={14} className="text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground truncate">{artifact.title}</span>
          {artifact.language && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
              {languageLabels[artifact.language] || artifact.language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {['html', 'app'].includes(artifact.type) && (
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
              title={previewMode ? 'Show code' : 'Preview'}
            >
              {previewMode ? <Code size={12} /> : <Eye size={12} />}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
            title="Copy"
          >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
            title="Download"
          >
            <Download size={12} />
          </button>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        {artifact.type === 'image' && artifact.url ? (
          <div className="p-3">
            <img
              src={artifact.url}
              alt={artifact.title}
              className="max-w-full rounded-lg border border-border/30"
            />
          </div>
        ) : ['html', 'app'].includes(artifact.type) && previewMode ? (
          <div className="p-3">
            <iframe
              srcDoc={getArtifactPreviewHtml(artifact) || artifact.content}
              className="w-full h-64 rounded-lg border border-border/30 bg-white"
              sandbox="allow-scripts allow-forms allow-modals"
              title={artifact.title}
            />
          </div>
        ) : artifact.type === 'pdf' && artifact.url ? (
          <div className="p-3">
            <iframe
              src={artifact.url}
              className="w-full h-64 rounded-lg border border-border/30 bg-white"
              title={artifact.title}
            />
          </div>
        ) : (
          <div className="relative">
            <pre className={`p-3 text-xs font-mono leading-relaxed overflow-x-auto scrollbar-thin ${
              artifact.type === 'terminal'
                ? 'text-success bg-[hsl(240_33%_3%)]'
                : 'text-foreground'
            }`}>
              <code>{displayContent}</code>
            </pre>
            {isLong && !expanded && (
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none" />
            )}
          </div>
        )}

        {/* Webpage preview */}
        {artifact.type === 'webpage' && artifact.url && (
          <div className="px-3 pb-3">
            <a
              href={artifact.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink size={11} />
              Open in browser
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtifactCard;
