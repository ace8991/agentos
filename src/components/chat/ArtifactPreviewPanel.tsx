import { createPortal } from 'react-dom';
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
  Maximize2,
  Minimize2,
  Monitor,
  Smartphone,
  Tablet,
  TerminalSquare,
  Wand2,
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
  tablet: 'w-[860px] max-w-full',
  mobile: 'w-[410px] max-w-full',
};

const ArtifactPreviewPanel = ({ artifact }: ArtifactPreviewPanelProps) => {
  const [activeTab, setActiveTab] = useState<PreviewTab>('preview');
  const [deviceFrame, setDeviceFrame] = useState<DeviceFrame>('desktop');
  const [slideIndex, setSlideIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [generatedPreviewUrl, setGeneratedPreviewUrl] = useState<string | null>(null);

  const slides = useMemo(() => (artifact.type === 'slides' ? parseSlides(artifact.content, artifact.title) : []), [artifact.content, artifact.title, artifact.type]);
  const outline = useMemo(() => extractOutline(artifact), [artifact]);
  const stats = useMemo(() => getArtifactStats(artifact), [artifact]);
  const previewHtml = useMemo(() => getArtifactPreviewHtml(artifact), [artifact]);
  const artifactMimeType = useMemo(() => getArtifactMimeType(artifact), [artifact]);

  useEffect(() => {
    setActiveTab('preview');
    setSlideIndex(0);
    setDeviceFrame('desktop');
    setFullscreen(false);
  }, [artifact.id]);

  useEffect(() => {
    if (artifact.url) {
      setGeneratedPreviewUrl(null);
      return;
    }
    if ((artifact.type === 'app' || artifact.type === 'html') && previewHtml) {
      const blob = new Blob([previewHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setGeneratedPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (artifact.content) {
      const blob = new Blob([artifact.content], { type: artifactMimeType });
      const url = URL.createObjectURL(blob);
      setGeneratedPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setGeneratedPreviewUrl(null);
    return;
  }, [artifact.content, artifact.type, artifact.url, artifactMimeType, previewHtml]);

  const previewLaunchUrl = artifact.url || generatedPreviewUrl;
  const outlineItems = outline.slice(0, 8);
  const activeSlide = slides[slideIndex] ?? null;
  const availableTabs: PreviewTab[] = ['preview', ...(artifact.content ? ['source'] as PreviewTab[] : []), ...(outline.length ? ['outline'] as PreviewTab[] : [])];
  const hostLabel = useMemo(() => {
    if (!previewLaunchUrl) return 'workspace://artifact-preview';
    try {
      const url = new URL(previewLaunchUrl);
      return `${url.host}${url.pathname === '/' ? '' : url.pathname}`;
    } catch {
      return previewLaunchUrl;
    }
  }, [previewLaunchUrl]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content || artifact.url || '');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const extension = artifact.filename?.split('.').pop() || artifact.language || (artifact.type === 'slides' ? 'md' : artifact.type === 'app' ? 'html' : artifact.type);
    const blob = new Blob([artifact.content], { type: getArtifactMimeType(artifact) });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = artifact.filename || `${artifact.title.replace(/\s+/g, '-').toLowerCase()}.${extension}`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const renderPreviewSurface = (expanded = false) => {
    if (artifact.type === 'image' && artifact.url) {
      return (
        <div className="flex min-h-[520px] items-center justify-center rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-4">
          <img src={artifact.url} alt={artifact.title} className={cn('max-w-full rounded-[24px] border border-white/10 object-contain shadow-[0_24px_80px_rgba(0,0,0,0.28)]', expanded ? 'max-h-[82vh]' : 'max-h-[620px]')} />
        </div>
      );
    }

    if (artifact.type === 'pdf' && previewLaunchUrl) {
      return <iframe src={previewLaunchUrl} title={artifact.title} className={cn('w-full rounded-[28px] border border-white/10 bg-white', expanded ? 'h-[82vh]' : 'h-[720px]')} />;
    }

    if (artifact.type === 'slides') {
      if (!artifact.content.trim()) {
        return <ExternalAssetPlaceholder artifact={artifact} title="Slides asset ready" description="Open the original deck in a new tab or download it from the workspace actions." icon={LayoutPanelTop} />;
      }
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-white/45">Slides stage</p>
              <p className="mt-1 text-sm text-white/72">{slides.length} slide{slides.length === 1 ? '' : 's'} ready in the deck</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSlideIndex(Math.max(0, slideIndex - 1))} disabled={slideIndex === 0} className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/72 disabled:opacity-35"><ChevronLeft size={14} /></button>
              <span className="text-xs text-white/65">{slideIndex + 1} / {slides.length}</span>
              <button onClick={() => setSlideIndex(Math.min(slides.length - 1, slideIndex + 1))} disabled={slideIndex >= slides.length - 1} className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/72 disabled:opacity-35"><ChevronRight size={14} /></button>
            </div>
          </div>
          <div className="rounded-[30px] bg-[linear-gradient(145deg,rgba(38,73,161,0.42),rgba(14,18,27,0.96)_46%,rgba(65,41,147,0.72))] p-[1px] shadow-[0_28px_90px_rgba(0,0,0,0.3)]">
            <div className="rounded-[29px] border border-white/8 bg-[#0c1018] p-6 md:p-8">
              <div className={cn('mx-auto rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(95,146,255,0.16),transparent_24%),#0f1420] p-8 shadow-inner md:p-10', expanded ? 'min-h-[78vh] max-w-5xl' : 'min-h-[520px] max-w-4xl')}>
                {activeSlide ? <DocumentRenderer content={activeSlide.content} /> : null}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if ((artifact.type === 'app' || artifact.type === 'html') && previewHtml) {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/64">
            Interactive runtime is mounted inside the workspace. Use full preview or open the artifact in an external tab when you need a standalone view.
          </div>
          <div className="flex justify-center">
            <div className={cn('overflow-hidden rounded-[30px] border border-white/10 bg-[#0d1018] shadow-[0_28px_90px_rgba(0,0,0,0.34)] transition-all', deviceWidths[deviceFrame])}>
              <div className="flex items-center gap-2 border-b border-white/10 bg-[#161a24] px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <div className="ml-2 inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] text-white/62">
                  <Globe size={11} className="shrink-0" />
                  <span className="truncate font-mono">{artifact.title}</span>
                </div>
              </div>
              <iframe srcDoc={previewHtml} sandbox="allow-scripts allow-forms allow-modals" className={cn('w-full bg-white', expanded ? 'h-[82vh]' : 'h-[720px]')} title={artifact.title} />
            </div>
          </div>
        </div>
      );
    }

    if (artifact.type === 'webpage' && previewLaunchUrl) {
      return <iframe src={previewLaunchUrl} title={artifact.title} className={cn('w-full rounded-[28px] border border-white/10 bg-white', expanded ? 'h-[82vh]' : 'h-[720px]')} />;
    }

    if (artifact.type === 'csv') return <CsvPreview content={artifact.content} expanded={expanded} />;
    if (artifact.type === 'terminal') return <SourcePreview artifact={artifact} maxHeight={expanded ? 'max-h-[82vh]' : 'max-h-[720px]'} tone="terminal" />;

    if (['markdown', 'document', 'pdf'].includes(artifact.type)) {
      if (!artifact.content.trim() && artifact.url) {
        return <ExternalAssetPlaceholder artifact={artifact} title="Document asset ready" description="This document is available as an external file. Open it in a new tab or download it from the workspace actions." icon={FileText} />;
      }
      return (
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5 md:p-7">
          <div className={cn('mx-auto rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,13,21,0.36),rgba(9,13,21,0.08))] p-6 md:p-8', expanded ? 'max-w-5xl min-h-[78vh]' : 'max-w-4xl')}>
            <DocumentRenderer content={artifact.content} />
          </div>
        </div>
      );
    }

    return <SourcePreview artifact={artifact} maxHeight={expanded ? 'max-h-[82vh]' : 'max-h-[720px]'} />;
  };

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.016))] shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
          <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(17,21,33,0.96),rgba(14,18,28,0.88))] px-4 py-4 md:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/60">
                  <Wand2 size={12} />
                  Preview runtime
                </div>
                <h3 className="mt-3 truncate text-xl font-semibold tracking-tight text-white">{artifact.title}</h3>
                <p className="mt-1 text-sm text-white/58">{previewModeLabel(artifact.type)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {availableTabs.map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={cn('rounded-full border px-3 py-1.5 text-xs font-medium transition-colors', activeTab === tab ? 'border-sky-300/18 bg-sky-400/10 text-sky-100' : 'border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white')}>
                    {tab === 'preview' ? 'Preview' : tab === 'source' ? 'Source' : 'Outline'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-b border-white/10 px-4 py-3 md:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 flex-1 overflow-hidden rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="ml-2 flex min-w-0 items-center gap-2 rounded-full bg-[#101522] px-3 py-1.5 text-[11px] text-white/65">
                    <Globe size={11} className="shrink-0 text-white/44" />
                    <span className="truncate font-mono">{hostLabel}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {['app', 'html', 'webpage'].includes(artifact.type) && (
                  <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
                    <DeviceButton active={deviceFrame === 'desktop'} icon={Monitor} onClick={() => setDeviceFrame('desktop')} />
                    <DeviceButton active={deviceFrame === 'tablet'} icon={Tablet} onClick={() => setDeviceFrame('tablet')} />
                    <DeviceButton active={deviceFrame === 'mobile'} icon={Smartphone} onClick={() => setDeviceFrame('mobile')} />
                  </div>
                )}
                <ActionButton icon={Copy} label={copied ? 'Copied' : 'Copy'} onClick={handleCopy} />
                <ActionButton icon={Download} label="Download" onClick={handleDownload} />
                {previewLaunchUrl && <ActionButton icon={ExternalLink} label="Open external" onClick={() => window.open(previewLaunchUrl, '_blank', 'noopener,noreferrer')} />}
                {activeTab === 'preview' && <ActionButton icon={Maximize2} label="Full preview" onClick={() => setFullscreen(true)} />}
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5">
            {activeTab === 'preview' ? renderPreviewSurface() : activeTab === 'source' ? <SourcePreview artifact={artifact} /> : <OutlinePreview artifact={artifact} outline={outline} slideIndex={slideIndex} setSlideIndex={setSlideIndex} />}
          </div>
        </section>

        <aside className="space-y-4">
          <InfoCard title="Preview intelligence" badge={<AppWindow size={12} />} body={getArtifactSummary(artifact)}>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatTile label="Type" value={artifact.type} />
              <StatTile label="Lines" value={String(stats.lines)} />
              <StatTile label="Words" value={String(stats.words)} />
            </div>
          </InfoCard>

          <InfoCard title="Workspace details">
            <div className="mt-3 space-y-2 text-sm text-white/65">
              <InfoRow label="Source" value={artifact.sourceLabel || 'Conversation'} />
              <InfoRow label="Filename" value={artifact.filename || 'Inline artifact'} />
              <InfoRow label="Bytes" value={Intl.NumberFormat().format(stats.bytes)} />
              {artifact.language && <InfoRow label="Language" value={artifact.language} />}
              <InfoRow label="Mode" value={previewModeLabel(artifact.type)} />
              {previewLaunchUrl && <InfoRow label="Preview link" value={hostLabel} truncate />}
            </div>
          </InfoCard>

          <InfoCard title="Detected surfaces">
            <div className="mt-3 space-y-2">
              <ModeChip active={['app', 'html', 'webpage'].includes(artifact.type)} icon={AppWindow} label="Interactive surface" />
              <ModeChip active={artifact.type === 'slides'} icon={LayoutPanelTop} label="Slides deck" />
              <ModeChip active={['markdown', 'document', 'pdf'].includes(artifact.type)} icon={BookOpenText} label="Document reader" />
              <ModeChip active={['code', 'terminal', 'csv'].includes(artifact.type)} icon={Code2} label="Source inspector" />
              <ModeChip active={artifact.type === 'image'} icon={ImageIcon} label="Media canvas" />
            </div>
          </InfoCard>

          {outlineItems.length > 0 && (
            <InfoCard title="Quick outline">
              <div className="mt-3 space-y-2">
                {outlineItems.map((item, index) => (
                  <button key={item.id} onClick={() => artifact.type === 'slides' && setSlideIndex(index)} className={cn('w-full rounded-2xl border px-3 py-2 text-left text-sm transition-colors', artifact.type === 'slides' && slideIndex === index ? 'border-sky-300/18 bg-sky-400/10 text-sky-100' : 'border-white/10 bg-white/[0.03] text-white/68 hover:bg-white/[0.06] hover:text-white')}>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">{item.meta}</div>
                    <div className="mt-1">{item.label}</div>
                  </button>
                ))}
              </div>
            </InfoCard>
          )}
        </aside>
      </div>

      {fullscreen && createPortal(
        <div className="fixed inset-0 z-[70] bg-black/82 backdrop-blur-md">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:px-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">Full preview</div>
                <div className="mt-1 text-lg font-medium text-white">{artifact.title}</div>
              </div>
              <div className="flex items-center gap-2">
                {previewLaunchUrl && <ActionButton icon={ExternalLink} label="Open external" onClick={() => window.open(previewLaunchUrl, '_blank', 'noopener,noreferrer')} />}
                <ActionButton icon={Minimize2} label="Exit full preview" onClick={() => setFullscreen(false)} />
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 md:p-6">{renderPreviewSurface(true)}</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

const ExternalAssetPlaceholder = ({ artifact, title, description, icon: Icon }: { artifact: Artifact; title: string; description: string; icon: typeof Eye }) => (
  <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-6">
    <div className="max-w-md text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/72"><Icon size={20} /></div>
      <h4 className="mt-4 text-lg font-medium text-white">{title}</h4>
      <p className="mt-2 text-sm leading-relaxed text-white/62">{description}</p>
      {artifact.url && <a href={artifact.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full border border-sky-300/18 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-100"><ExternalLink size={14} />Open original</a>}
    </div>
  </div>
);

const SourcePreview = ({ artifact, maxHeight = 'max-h-[620px]', tone = 'default' }: { artifact: Artifact; maxHeight?: string; tone?: 'default' | 'terminal' }) => {
  const lines = (artifact.content || '').split('\n');
  return (
    <div className={cn('overflow-hidden rounded-[24px] border border-white/10', tone === 'terminal' ? 'bg-[#07090f]' : 'bg-[#0b0e16]')}>
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3 text-xs uppercase tracking-[0.18em] text-white/45"><Code2 size={12} />Source</div>
      <div className={cn('overflow-auto', maxHeight)}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 p-4 font-mono text-xs leading-6">
          <div className="select-none text-right text-white/25">{lines.map((_, index) => <div key={`n-${index}`}>{index + 1}</div>)}</div>
          <pre className="min-w-0 whitespace-pre-wrap break-words text-white/84"><code>{artifact.content}</code></pre>
        </div>
      </div>
    </div>
  );
};

const OutlinePreview = ({ artifact, outline, slideIndex, setSlideIndex }: { artifact: Artifact; outline: ReturnType<typeof extractOutline>; slideIndex: number; setSlideIndex: (value: number) => void }) => {
  if (outline.length === 0) return <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.03] text-sm text-white/55">No outline detected for this artifact.</div>;
  return <div className="grid gap-3 md:grid-cols-2">{outline.map((item, index) => <button key={item.id} onClick={() => artifact.type === 'slides' && setSlideIndex(index)} className={cn('rounded-2xl border px-4 py-3 text-left transition-colors', artifact.type === 'slides' && slideIndex === index ? 'border-sky-300/20 bg-sky-400/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]')}><p className="text-[11px] uppercase tracking-[0.18em] text-white/42">{item.meta}</p><p className="mt-2 text-sm font-medium text-white">{item.label}</p></button>)}</div>;
};

const CsvPreview = ({ content, expanded }: { content: string; expanded: boolean }) => {
  const rows = content.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, expanded ? 60 : 24).map((line) => line.split(',').map((cell) => cell.trim()));
  if (rows.length === 0) return <div className="flex min-h-[280px] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.03] text-sm text-white/55">CSV is empty.</div>;
  const [header, ...body] = rows;
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10">
      <div className={cn('overflow-auto', expanded ? 'max-h-[82vh]' : 'max-h-[720px]')}>
        <table className="min-w-full divide-y divide-white/10 text-left text-sm text-white/78">
          <thead className="sticky top-0 bg-[#161a24]"><tr>{header.map((cell, index) => <th key={`h-${index}`} className="px-4 py-3 font-medium">{cell}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/6 bg-white/[0.02]">{body.map((row, rowIndex) => <tr key={`r-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`c-${rowIndex}-${cellIndex}`} className="px-4 py-3 text-white/65">{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
};

const DocumentRenderer = ({ content }: { content: string }) => {
  const blocks = useMemo(() => splitMarkdownBlocks(content), [content]);
  return <div className="mx-auto max-w-3xl text-left text-white/86">{blocks.map((block, index) => renderMarkdownBlock(block, index))}</div>;
};

const splitMarkdownBlocks = (content: string) => content.replace(/\r\n/g, '\n').trim().split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

const renderMarkdownBlock = (block: string, index: number) => {
  const lines = block.split('\n');
  if (lines.every((line) => /^[-*]\s+/.test(line))) return <ul key={index} className="mb-5 space-y-2 pl-5 text-sm leading-7 text-white/78">{lines.map((line, itemIndex) => <li key={itemIndex} className="list-disc">{renderInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>)}</ul>;
  if (lines.every((line) => /^\d+\.\s+/.test(line))) return <ol key={index} className="mb-5 space-y-2 pl-5 text-sm leading-7 text-white/78">{lines.map((line, itemIndex) => <li key={itemIndex} className="list-decimal">{renderInlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</li>)}</ol>;
  if (/^###\s+/.test(lines[0])) return <h3 key={index} className="mb-3 mt-6 text-lg font-semibold text-white">{renderInlineMarkdown(lines[0].replace(/^###\s+/, ''))}</h3>;
  if (/^##\s+/.test(lines[0])) return <h2 key={index} className="mb-4 mt-7 text-2xl font-semibold tracking-tight text-white">{renderInlineMarkdown(lines[0].replace(/^##\s+/, ''))}</h2>;
  if (/^#\s+/.test(lines[0])) return <h1 key={index} className="mb-5 text-3xl font-semibold tracking-tight text-white">{renderInlineMarkdown(lines[0].replace(/^#\s+/, ''))}</h1>;
  if (lines.every((line) => /^>\s?/.test(line))) return <blockquote key={index} className="mb-5 border-l-2 border-sky-300/30 pl-4 text-sm italic leading-7 text-white/70">{lines.map((line, lineIndex) => <p key={lineIndex}>{renderInlineMarkdown(line.replace(/^>\s?/, ''))}</p>)}</blockquote>;
  return <p key={index} className="mb-5 text-sm leading-7 text-white/78">{renderInlineMarkdown(lines.join(' '))}</p>;
};

const renderInlineMarkdown = (text: string) => text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean).map((part, index) => {
  if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
  if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-sky-100">{part.slice(1, -1)}</code>;
  const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (linkMatch) return <a key={index} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-sky-200 underline decoration-sky-400/40 underline-offset-4 transition-colors hover:text-white">{linkMatch[1]}</a>;
  return <span key={index}>{part}</span>;
});

const DeviceButton = ({ active, icon: Icon, onClick }: { active: boolean; icon: typeof Monitor; onClick: () => void }) => (
  <button onClick={onClick} className={cn('rounded-full p-2 transition-colors', active ? 'bg-white text-slate-900 shadow-sm' : 'text-white/62 hover:text-white')}><Icon size={13} /></button>
);

const ActionButton = ({ icon: Icon, label, onClick }: { icon: typeof Download; label: string; onClick: () => void }) => (
  <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"><Icon size={12} />{label}</button>
);

const InfoCard = ({ title, badge, body, children }: { title: string; badge?: React.ReactNode; body?: string; children?: React.ReactNode }) => (
  <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-4">
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/58">{badge || <Globe size={12} />}{title}</div>
    {body && <p className="mt-3 text-sm leading-relaxed text-white/64">{body}</p>}
    {children}
  </div>
);

const StatTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
    <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</div>
    <div className="mt-2 truncate text-sm font-medium text-white">{value}</div>
  </div>
);

const ModeChip = ({ active, icon: Icon, label }: { active: boolean; icon: typeof Eye; label: string }) => (
  <div className={cn('inline-flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition-colors', active ? 'border-sky-300/18 bg-sky-400/10 text-sky-100' : 'border-white/10 bg-white/[0.03] text-white/55')}>
    <Icon size={14} />
    {label}
  </div>
);

const InfoRow = ({ label, value, truncate = false }: { label: string; value: string; truncate?: boolean }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="shrink-0 text-white/42">{label}</span>
    <span className={cn('text-right text-white/74', truncate && 'max-w-[180px] truncate')}>{value}</span>
  </div>
);

const previewModeLabel = (type: Artifact['type']) => ({
  app: 'Interactive app preview',
  html: 'Interactive page preview',
  webpage: 'Linked webpage preview',
  slides: 'Slides stage',
  markdown: 'Document reader',
  document: 'Document reader',
  pdf: 'Document asset',
  image: 'Media canvas',
  code: 'Source inspector',
  terminal: 'Console artifact',
  csv: 'Structured data viewer',
})[type] || 'Artifact preview';

export default ArtifactPreviewPanel;
