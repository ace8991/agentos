import { useEffect, useMemo, useState } from 'react';
import {
  AppWindow,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Image as ImageIcon,
  LayoutPanelTop,
  Monitor,
  Smartphone,
  Tablet,
  TerminalSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type Artifact,
  type SlideFrame,
  extractOutline,
  getArtifactMimeType,
  getArtifactPreviewHtml,
  getArtifactStats,
  getArtifactSummary,
  parseSlides,
} from '@/lib/artifacts';

type PreviewTab = 'preview' | 'source' | 'outline';
type DeviceFrame = 'desktop' | 'tablet' | 'mobile';

interface ArtifactPreviewPanelProps {
  artifact: Artifact;
}

const deviceWidths: Record<DeviceFrame, string> = {
  desktop: 'w-full',
  tablet: 'w-[840px] max-w-full',
  mobile: 'w-[390px] max-w-full',
};

const ArtifactPreviewPanel = ({ artifact }: ArtifactPreviewPanelProps) => {
  const [activeTab, setActiveTab] = useState<PreviewTab>('preview');
  const [deviceFrame, setDeviceFrame] = useState<DeviceFrame>('desktop');
  const [slideIndex, setSlideIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const slides = useMemo(
    () => (artifact.type === 'slides' ? parseSlides(artifact.content, artifact.title) : []),
    [artifact.content, artifact.title, artifact.type],
  );
  const outline = useMemo(() => extractOutline(artifact), [artifact]);
  const stats = useMemo(() => getArtifactStats(artifact), [artifact]);
  const previewHtml = useMemo(() => getArtifactPreviewHtml(artifact), [artifact]);

  useEffect(() => {
    setActiveTab('preview');
    setSlideIndex(0);
    setDeviceFrame('desktop');
  }, [artifact.id]);

  const availableTabs: PreviewTab[] = useMemo(() => {
    const tabs: PreviewTab[] = ['preview'];
    if (artifact.content) tabs.push('source');
    if (outline.length > 0) tabs.push('outline');
    return tabs;
  }, [artifact.content, outline.length]);

  const activeSlide = slides[slideIndex] ?? null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content || artifact.url || '');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const extension =
      artifact.filename?.split('.').pop() ||
      artifact.language ||
      (artifact.type === 'slides' ? 'md' : artifact.type === 'app' ? 'html' : artifact.type);
    const blob = new Blob([artifact.content], { type: getArtifactMimeType(artifact) });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download =
      artifact.filename || `${artifact.title.replace(/\s+/g, '-').toLowerCase()}.${extension}`;
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  activeTab === tab
                    ? 'border-sky-300/18 bg-sky-400/12 text-sky-100'
                    : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08]',
                )}
              >
                {tab === 'preview' ? 'Preview' : tab === 'source' ? 'Source' : 'Outline'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {['app', 'html', 'webpage'].includes(artifact.type) && (
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
                <DeviceButton
                  active={deviceFrame === 'desktop'}
                  icon={Monitor}
                  onClick={() => setDeviceFrame('desktop')}
                />
                <DeviceButton
                  active={deviceFrame === 'tablet'}
                  icon={Tablet}
                  onClick={() => setDeviceFrame('tablet')}
                />
                <DeviceButton
                  active={deviceFrame === 'mobile'}
                  icon={Smartphone}
                  onClick={() => setDeviceFrame('mobile')}
                />
              </div>
            )}

            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <Copy size={12} />
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <Download size={12} />
              Download
            </button>
            {artifact.url && (
              <a
                href={artifact.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                <ExternalLink size={12} />
                Open
              </a>
            )}
          </div>
        </div>

        <div className="min-h-[420px] p-4 md:p-5">
          {activeTab === 'preview' && (
            <ArtifactPreviewSurface
              artifact={artifact}
              previewHtml={previewHtml}
              slides={slides}
              slideIndex={slideIndex}
              setSlideIndex={setSlideIndex}
              activeSlide={activeSlide}
              deviceFrame={deviceFrame}
            />
          )}
          {activeTab === 'source' && <SourcePreview artifact={artifact} />}
          {activeTab === 'outline' && (
            <OutlinePreview
              artifact={artifact}
              outline={outline}
              slideIndex={slideIndex}
              setSlideIndex={setSlideIndex}
            />
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
            <LayoutPanelTop size={12} />
            Preview intelligence
          </div>
          <h3 className="mt-3 text-lg font-medium text-white">{artifact.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/65">{getArtifactSummary(artifact)}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <StatTile label="Type" value={artifact.type} />
            <StatTile label="Lines" value={String(stats.lines)} />
            <StatTile label="Words" value={String(stats.words)} />
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <h4 className="text-sm font-medium text-white">Workspace details</h4>
          <div className="mt-3 space-y-2 text-sm text-white/65">
            <InfoRow label="Source" value={artifact.sourceLabel || 'Conversation'} />
            <InfoRow label="Filename" value={artifact.filename || 'Inline artifact'} />
            <InfoRow label="Bytes" value={Intl.NumberFormat().format(stats.bytes)} />
            {artifact.language && <InfoRow label="Language" value={artifact.language} />}
            {artifact.url && <InfoRow label="URL" value={artifact.url} truncate />}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <h4 className="text-sm font-medium text-white">Detected mode</h4>
          <div className="mt-3 space-y-2">
            <ModeChip
              active={['app', 'html', 'webpage'].includes(artifact.type)}
              icon={AppWindow}
              label="Interactive preview"
            />
            <ModeChip
              active={artifact.type === 'slides'}
              icon={LayoutPanelTop}
              label="Slides deck"
            />
            <ModeChip
              active={['markdown', 'document', 'pdf'].includes(artifact.type)}
              icon={BookOpenText}
              label="Document reader"
            />
            <ModeChip
              active={['code', 'terminal', 'csv'].includes(artifact.type)}
              icon={Code2}
              label="Source inspector"
            />
          </div>
        </div>
      </aside>
    </div>
  );
};

const ArtifactPreviewSurface = ({
  artifact,
  previewHtml,
  slides,
  slideIndex,
  setSlideIndex,
  activeSlide,
  deviceFrame,
}: {
  artifact: Artifact;
  previewHtml: string | null;
  slides: SlideFrame[];
  slideIndex: number;
  setSlideIndex: (value: number) => void;
  activeSlide: SlideFrame | null;
  deviceFrame: DeviceFrame;
}) => {
  if (artifact.type === 'image' && artifact.url) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-[24px] border border-white/10 bg-black/20 p-4">
        <img src={artifact.url} alt={artifact.title} className="max-h-[520px] max-w-full rounded-[22px] border border-white/10 object-contain shadow-2xl" />
      </div>
    );
  }

  if (artifact.type === 'pdf' && artifact.url) {
    return (
      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white">
        <iframe src={artifact.url} title={artifact.title} className="h-[640px] w-full" />
      </div>
    );
  }

  if (artifact.type === 'slides') {
    if (!artifact.content.trim()) {
      return (
        <ExternalAssetPlaceholder
          artifact={artifact}
          title="Slides asset ready"
          description="This deck is attached as an external file. Open it in a new tab or download it to review the original presentation."
          icon={LayoutPanelTop}
        />
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-white/50">Slides preview</p>
            <p className="mt-1 text-sm text-white/75">
              {slides.length} slide{slides.length === 1 ? '' : 's'} generated
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSlideIndex(Math.max(0, slideIndex - 1))}
              disabled={slideIndex === 0}
              className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-default disabled:opacity-35"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-white/65">
              {slideIndex + 1} / {slides.length}
            </span>
            <button
              onClick={() => setSlideIndex(Math.min(slides.length - 1, slideIndex + 1))}
              disabled={slideIndex >= slides.length - 1}
              className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-default disabled:opacity-35"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(57,82,184,0.18),rgba(11,14,22,0.94))] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.28)] md:p-6">
          <div className="mx-auto min-h-[420px] max-w-4xl rounded-[24px] border border-white/12 bg-[radial-gradient(circle_at_top_left,rgba(95,146,255,0.16),transparent_24%),#0f1420] p-8 shadow-inner md:p-10">
            {activeSlide ? <DocumentRenderer content={activeSlide.content} /> : null}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => setSlideIndex(index)}
              className={cn(
                'rounded-2xl border px-4 py-3 text-left transition-colors',
                slideIndex === index
                  ? 'border-sky-300/20 bg-sky-400/10'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
              )}
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Slide {index + 1}</p>
              <p className="mt-2 text-sm font-medium text-white">{slide.title}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (['app', 'html'].includes(artifact.type) && previewHtml) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/65">
          Live preview is running inside an isolated frame. Switch device presets to inspect layout behavior.
        </div>
        <div className="flex justify-center">
          <div className={cn('overflow-hidden rounded-[26px] border border-white/10 bg-[#0f1320] shadow-[0_28px_90px_rgba(0,0,0,0.34)] transition-all', deviceWidths[deviceFrame])}>
            <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] text-white/65">
                <Globe size={11} />
                {artifact.title}
              </div>
            </div>
            <iframe
              srcDoc={previewHtml}
              sandbox="allow-scripts allow-forms allow-modals"
              className="h-[620px] w-full bg-white"
              title={artifact.title}
            />
          </div>
        </div>
      </div>
    );
  }

  if (artifact.type === 'webpage' && artifact.url) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/65">
          External webpages may block embedding. Open the page in a new tab if the frame stays blank.
        </div>
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white">
          <iframe src={artifact.url} title={artifact.title} className="h-[620px] w-full" />
        </div>
      </div>
    );
  }

  if (artifact.type === 'csv') {
    return <CsvPreview content={artifact.content} />;
  }

  if (artifact.type === 'terminal') {
    return (
      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#07090f]">
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3 text-xs uppercase tracking-[0.18em] text-emerald-300/72">
          <TerminalSquare size={12} />
          Terminal output
        </div>
        <SourcePreview artifact={artifact} />
      </div>
    );
  }

  if (['markdown', 'document', 'pdf'].includes(artifact.type)) {
    if (!artifact.content.trim() && artifact.url) {
      return (
        <ExternalAssetPlaceholder
          artifact={artifact}
          title="Document asset ready"
          description="This document is available as an external file. Open it in a new tab or download it from the workspace actions."
          icon={FileText}
        />
      );
    }

    return (
      <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5 md:p-7">
        <DocumentRenderer content={artifact.content} />
      </div>
    );
  }

  return <SourcePreview artifact={artifact} />;
};

const ExternalAssetPlaceholder = ({
  artifact,
  title,
  description,
  icon: Icon,
}: {
  artifact: Artifact;
  title: string;
  description: string;
  icon: typeof Eye;
}) => (
  <div className="flex min-h-[360px] items-center justify-center rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-6">
    <div className="max-w-md text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/72">
        <Icon size={20} />
      </div>
      <h4 className="mt-4 text-lg font-medium text-white">{title}</h4>
      <p className="mt-2 text-sm leading-relaxed text-white/62">{description}</p>
      {artifact.url && (
        <a
          href={artifact.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-sky-300/18 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100"
        >
          <ExternalLink size={14} />
          Open original
        </a>
      )}
    </div>
  </div>
);

const SourcePreview = ({ artifact }: { artifact: Artifact }) => {
  const lines = (artifact.content || '').split('\n');

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#0b0e16]">
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3 text-xs uppercase tracking-[0.18em] text-white/45">
        <Code2 size={12} />
        Source
      </div>
      <div className="max-h-[620px] overflow-auto">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 p-4 font-mono text-xs leading-6">
          <div className="select-none text-right text-white/25">
            {lines.map((_, index) => (
              <div key={`n-${index}`}>{index + 1}</div>
            ))}
          </div>
          <pre className="min-w-0 whitespace-pre-wrap break-words text-white/84">
            <code>{artifact.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

const OutlinePreview = ({
  artifact,
  outline,
  slideIndex,
  setSlideIndex,
}: {
  artifact: Artifact;
  outline: ReturnType<typeof extractOutline>;
  slideIndex: number;
  setSlideIndex: (value: number) => void;
}) => {
  if (outline.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.03] text-sm text-white/55">
        No outline detected for this artifact.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {outline.map((item, index) => (
        <button
          key={item.id}
          onClick={() => artifact.type === 'slides' && setSlideIndex(index)}
          className={cn(
            'rounded-2xl border px-4 py-3 text-left transition-colors',
            artifact.type === 'slides' && slideIndex === index
              ? 'border-sky-300/20 bg-sky-400/10'
              : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
          )}
        >
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">{item.meta}</p>
          <p className="mt-2 text-sm font-medium text-white">{item.label}</p>
        </button>
      ))}
    </div>
  );
};

const CsvPreview = ({ content }: { content: string }) => {
  const rows = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24)
    .map((line) => line.split(',').map((cell) => cell.trim()));

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.03] text-sm text-white/55">
        CSV is empty.
      </div>
    );
  }

  const [header, ...body] = rows;

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10">
      <div className="overflow-auto">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm text-white/78">
          <thead className="bg-white/[0.05]">
            <tr>
              {header.map((cell, index) => (
                <th key={`h-${index}`} className="px-4 py-3 font-medium">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6 bg-white/[0.02]">
            {body.map((row, rowIndex) => (
              <tr key={`r-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`c-${rowIndex}-${cellIndex}`} className="px-4 py-3 text-white/65">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DocumentRenderer = ({ content }: { content: string }) => {
  const blocks = useMemo(() => splitMarkdownBlocks(content), [content]);
  return (
    <div className="mx-auto max-w-3xl text-left text-white/86">
      {blocks.map((block, index) => renderMarkdownBlock(block, index))}
    </div>
  );
};

const splitMarkdownBlocks = (content: string) => {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  return normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
};

const renderMarkdownBlock = (block: string, index: number) => {
  const lines = block.split('\n');

  if (lines.every((line) => /^[-*]\s+/.test(line))) {
    return (
      <ul key={index} className="mb-5 space-y-2 pl-5 text-sm leading-7 text-white/78">
        {lines.map((line, itemIndex) => (
          <li key={itemIndex} className="list-disc">
            {renderInlineMarkdown(line.replace(/^[-*]\s+/, ''))}
          </li>
        ))}
      </ul>
    );
  }

  if (lines.every((line) => /^\d+\.\s+/.test(line))) {
    return (
      <ol key={index} className="mb-5 space-y-2 pl-5 text-sm leading-7 text-white/78">
        {lines.map((line, itemIndex) => (
          <li key={itemIndex} className="list-decimal">
            {renderInlineMarkdown(line.replace(/^\d+\.\s+/, ''))}
          </li>
        ))}
      </ol>
    );
  }

  if (/^###\s+/.test(lines[0])) {
    return (
      <h3 key={index} className="mb-3 mt-6 text-lg font-semibold text-white">
        {renderInlineMarkdown(lines[0].replace(/^###\s+/, ''))}
      </h3>
    );
  }

  if (/^##\s+/.test(lines[0])) {
    return (
      <h2 key={index} className="mb-4 mt-7 text-2xl font-semibold tracking-tight text-white">
        {renderInlineMarkdown(lines[0].replace(/^##\s+/, ''))}
      </h2>
    );
  }

  if (/^#\s+/.test(lines[0])) {
    return (
      <h1 key={index} className="mb-5 text-3xl font-semibold tracking-tight text-white">
        {renderInlineMarkdown(lines[0].replace(/^#\s+/, ''))}
      </h1>
    );
  }

  if (lines.every((line) => /^>\s?/.test(line))) {
    return (
      <blockquote key={index} className="mb-5 border-l-2 border-sky-300/30 pl-4 text-sm italic leading-7 text-white/70">
        {lines.map((line, lineIndex) => (
          <p key={lineIndex}>{renderInlineMarkdown(line.replace(/^>\s?/, ''))}</p>
        ))}
      </blockquote>
    );
  }

  return (
    <p key={index} className="mb-5 text-sm leading-7 text-white/78">
      {renderInlineMarkdown(lines.join(' '))}
    </p>
  );
};

const renderInlineMarkdown = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-sky-100">
          {part.slice(1, -1)}
        </code>
      );
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-200 underline decoration-sky-400/40 underline-offset-4 transition-colors hover:text-white"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

const DeviceButton = ({
  active,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  icon: typeof Monitor;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      'rounded-full p-2 transition-colors',
      active ? 'bg-white text-slate-900 shadow-sm' : 'text-white/62 hover:text-white',
    )}
  >
    <Icon size={13} />
  </button>
);

const StatTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
    <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</div>
    <div className="mt-2 truncate text-sm font-medium text-white">{value}</div>
  </div>
);

const ModeChip = ({
  active,
  icon: Icon,
  label,
}: {
  active: boolean;
  icon: typeof Eye;
  label: string;
}) => (
  <div
    className={cn(
      'inline-flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition-colors',
      active
        ? 'border-sky-300/18 bg-sky-400/10 text-sky-100'
        : 'border-white/10 bg-white/[0.03] text-white/55',
    )}
  >
    <Icon size={14} />
    {label}
  </div>
);

const InfoRow = ({
  label,
  value,
  truncate = false,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) => (
  <div className="flex items-start justify-between gap-3">
    <span className="shrink-0 text-white/42">{label}</span>
    <span className={cn('text-right text-white/74', truncate && 'max-w-[180px] truncate')}>
      {value}
    </span>
  </div>
);

export default ArtifactPreviewPanel;
