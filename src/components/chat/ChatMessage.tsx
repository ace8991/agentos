import { useMemo, useState } from 'react';
import {
  AlertTriangle, Brain, CheckCircle, ChevronDown, ChevronRight,
  Code, Download, Eye, FileText, FilePen, FolderOpen, FolderSearch,
  Globe, Info, Loader2, MessageCircleQuestion, MousePointer,
  Paperclip, Search, Sparkles, Terminal,
} from 'lucide-react';
import { type LogEntry, type LogType } from '@/store/useStore';
import { parseArtifacts } from '@/lib/artifacts';
import ArtifactCard from './ArtifactCard';

// Type -> icon/label/color
const TYPE_CFG: Record<LogType, { icon: typeof Eye; label: string; color: string; pill: string }> = {
  perceive: { icon: Eye, label: 'Observing', color: 'text-primary', pill: 'bg-primary/10 text-primary' },
  plan: { icon: Brain, label: 'Planning', color: 'text-purple-400', pill: 'bg-purple-400/10 text-purple-300' },
  act: { icon: MousePointer, label: 'Acting', color: 'text-accent', pill: 'bg-accent/10 text-accent' },
  verify: { icon: CheckCircle, label: 'Verifying', color: 'text-emerald-400', pill: 'bg-emerald-400/10 text-emerald-300' },
  done: { icon: CheckCircle, label: 'Done', color: 'text-success', pill: 'bg-success/10 text-success' },
  error: { icon: AlertTriangle, label: 'Error', color: 'text-destructive', pill: 'bg-destructive/10 text-destructive' },
  browser: { icon: Globe, label: 'Browser', color: 'text-sky-400', pill: 'bg-sky-400/10 text-sky-300' },
  web: { icon: Search, label: 'Web search', color: 'text-blue-400', pill: 'bg-blue-400/10 text-blue-300' },
  shell: { icon: Terminal, label: 'Terminal', color: 'text-green-400', pill: 'bg-green-400/10 text-green-300' },
  info: { icon: Info, label: 'Info', color: 'text-muted-foreground', pill: 'bg-muted text-muted-foreground' },
  thinking: { icon: Loader2, label: 'Thinking', color: 'text-purple-400', pill: 'bg-purple-400/10 text-purple-300' },
  ask: { icon: MessageCircleQuestion, label: 'Question', color: 'text-accent', pill: 'bg-accent/10 text-accent' },
  result: { icon: Sparkles, label: 'Result', color: 'text-emerald-400', pill: 'bg-emerald-400/10 text-emerald-300' },
  file: { icon: FolderOpen, label: 'File system', color: 'text-amber-400', pill: 'bg-amber-400/10 text-amber-300' },
};

// File action sub-icons
const FILE_ICON: Record<string, typeof Eye> = {
  file_read: FileText,
  file_write: FilePen,
  file_append: FilePen,
  dir_list: FolderOpen,
  dir_create: FolderOpen,
  dir_delete: FolderOpen,
  file_search: FolderSearch,
  file_move: FolderOpen,
  file_copy: FolderOpen,
  file_exists: FileText,
  system_info: FileText,
  shell: Terminal,
};

// Helpers
const trunc = (v: string, max = 300) => {
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
};

const fname = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() || p;

interface StructuredSection {
  key: string;
  title: string;
  body: string[];
}

const SECTION_ALIAS_MAP: Record<string, string> = {
  resume: 'Resume',
  resultat: 'Resultat',
  result: 'Resultat',
  details: 'Details',
  'prochaine etape': 'Prochaine etape',
  'next step': 'Prochaine etape',
};

const normalizeSectionKey = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const parseStructuredSections = (text: string) => {
  const normalizedText = text.replace(/\r\n/g, '\n').trim();
  if (!normalizedText) {
    return { sections: [] as StructuredSection[], remainder: '' };
  }

  const lines = normalizedText.split('\n');
  const sections: StructuredSection[] = [];
  const remainder: string[] = [];
  let current: StructuredSection | null = null;

  const flushCurrent = () => {
    if (!current) return;
    sections.push({
      ...current,
      body: current.body.map((line) => line.trimEnd()).filter(Boolean),
    });
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const boldLabelMatch = line.match(/^\*\*([^*]+)\*\*$/);
    const colonLabelMatch = line.match(/^([A-Za-zÀ-ÿ ]+):\s*(.*)$/);

    const rawLabel = boldLabelMatch?.[1] ?? colonLabelMatch?.[1] ?? '';
    const normalizedLabel = normalizeSectionKey(rawLabel);
    const canonicalTitle = SECTION_ALIAS_MAP[normalizedLabel];

    if (canonicalTitle) {
      flushCurrent();
      current = { key: normalizedLabel, title: canonicalTitle, body: [] };
      const inlineContent = colonLabelMatch?.[2]?.trim();
      if (inlineContent) current.body.push(inlineContent);
      continue;
    }

    if (current) {
      current.body.push(rawLine);
    } else if (line) {
      remainder.push(rawLine);
    }
  }

  flushCurrent();
  return { sections, remainder: remainder.join('\n').trim() };
};

const renderInline = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-white/96">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic text-white/82">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-sky-200">{part.slice(1, -1)}</code>;
    }
    const m = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (m) {
      return <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline-offset-2 hover:underline">{m[1]}</a>;
    }
    return <span key={i}>{part}</span>;
  });
};

// Markdown renderer (Claude-style)
const renderMd = (text: string) => {
  if (!text?.trim()) return null;

  const { sections, remainder } = parseStructuredSections(text);
  if (sections.length > 0) {
    return (
      <div className="space-y-3">
        {sections.map((section) => {
          const isList = section.body.length > 0 && section.body.every((line) => line.trim().startsWith('- '));
          const isDetailsSection = section.title === 'Details';
          const detailsContent = isList ? (
            <ul className="space-y-1.5 pl-1">
              {section.body.map((line, index) => (
                <li key={`${section.key}-${index}`} className="flex items-start gap-2.5">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                  <span className="text-white/85">{renderInline(line.trim().replace(/^- /, ''))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2">
              {section.body.map((line, index) => (
                <p key={`${section.key}-${index}`} className="text-white/88 leading-7">
                  {renderInline(line.trim())}
                </p>
              ))}
            </div>
          );

          return (
            <section key={section.key} className="rounded-2xl border border-white/7 bg-white/[0.035] px-4 py-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/72">
                {section.title}
              </div>

              {isDetailsSection ? (
                <details className="group">
                  <summary className="cursor-pointer list-none text-sm text-white/70 transition-colors hover:text-white/88">
                    View step details
                  </summary>
                  <div className="mt-3">{detailsContent}</div>
                </details>
              ) : (
                detailsContent
              )}
            </section>
          );
        })}

        {remainder && (
          <div className="rounded-2xl border border-white/7 bg-white/[0.02] px-4 py-3">
            <p className="text-white/78 leading-7">{renderInline(remainder)}</p>
          </div>
        )}
      </div>
    );
  }

  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-3 text-[15px] leading-7">
      {blocks.map((block, bi) => {
        if (block.startsWith('```')) {
          const lines = block.split('\n');
          const lang = lines[0].replace('```', '').trim();
          const code = lines.slice(1, lines[lines.length - 1] === '```' ? -1 : undefined).join('\n');
          return (
            <div key={bi} className="rounded-xl overflow-hidden border border-white/10 bg-black/30">
              {lang && (
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/8 bg-white/[0.03]">
                  <Code size={11} className="text-white/40" />
                  <span className="text-[11px] text-white/40 font-mono">{lang}</span>
                </div>
              )}
              <pre className="p-4 overflow-x-auto whitespace-pre-wrap text-[12.5px] font-mono leading-6 text-white/85">{code}</pre>
            </div>
          );
        }

        const h3 = block.match(/^### (.+)/);
        const h2 = block.match(/^## (.+)/);
        const h1 = block.match(/^# (.+)/);
        if (h1) return <h1 key={bi} className="mt-2 text-lg font-semibold text-white">{h1[1]}</h1>;
        if (h2) return <h2 key={bi} className="mt-1.5 text-base font-semibold text-white/95">{h2[1]}</h2>;
        if (h3) return <h3 key={bi} className="mt-1 text-sm font-semibold uppercase tracking-wide text-white/90">{h3[1]}</h3>;
        if (block === '---' || block === '***') return <hr key={bi} className="border-white/10" />;

        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.every((l) => /^[-*+]\s/.test(l))) {
          return (
            <ul key={bi} className="space-y-1.5 pl-1">
              {lines.map((l, li) => (
                <li key={li} className="flex items-start gap-2.5">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/70" />
                  <span className="text-white/85">{renderInline(l.replace(/^[-*+]\s/, ''))}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={bi} className="space-y-1.5 pl-1">
              {lines.map((l, li) => (
                <li key={li} className="flex items-start gap-2.5">
                  <span className="mt-1 shrink-0 text-[11px] font-mono text-emerald-400/70">{li + 1}.</span>
                  <span className="text-white/85">{renderInline(l.replace(/^\d+\.\s/, ''))}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (lines.every((l) => l.startsWith('> '))) {
          return (
            <blockquote key={bi} className="border-l-2 border-white/20 pl-4 italic text-white/68">
              {lines.map((l) => l.slice(2)).join(' ')}
            </blockquote>
          );
        }

        if (lines.length === 1 && /^\*\*[^*]+\*\*$/.test(lines[0])) {
          return (
            <p key={bi} className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300/70">
              {lines[0].slice(2, -2)}
            </p>
          );
        }

        return <p key={bi} className="leading-7 text-white/88">{renderInline(block)}</p>;
      })}
    </div>
  );
};

const useToolHighlights = (entry: LogEntry) =>
  useMemo(() => {
    const r = entry.tool_result;
    const at = entry.actionType || '';
    if (!r && !at) return { summary: entry.action, preview: '', chips: [] as string[], shellOut: '' };

    const desc = typeof r?.description === 'string' ? r.description : '';
    let summary = desc || entry.action;
    let preview = '';
    let shellOut = '';
    const chips: string[] = [];

    if (at === 'file_read') {
      const path = typeof r?.path === 'string' ? r.path : '';
      if (path) chips.push(fname(path));
      if (typeof r?.lines_read === 'number') chips.push(`${r.lines_read} lines`);
      if (r?.truncated) chips.push('truncated');
      preview = typeof r?.content === 'string' ? trunc(r.content, 500) : '';
      summary = desc || `Read ${path ? fname(path) : 'file'}`;
    } else if (at === 'file_write' || at === 'file_append') {
      const path = typeof r?.path === 'string' ? r.path : '';
      if (path) chips.push(fname(path));
      if (typeof r?.bytes_written === 'number') chips.push(`${r.bytes_written} bytes`);
      summary = desc || `${at === 'file_append' ? 'Updated' : 'Wrote'} ${path ? fname(path) : 'file'}`;
    } else if (at === 'dir_list') {
      const path = typeof r?.path === 'string' ? r.path : '';
      if (path) chips.push(fname(path) || path);
      const entries = Array.isArray(r?.items)
        ? r.items.filter((item): item is { type?: string; name?: string } => typeof item === 'object' && item !== null)
        : [];
      chips.push(`${entries.length} items`);
      preview = entries
        .slice(0, 8)
        .map((entryItem) => `${entryItem.type === 'directory' ? '📁' : '📄'} ${entryItem.name ?? 'Unknown'}`)
        .join('\n');
      summary = desc || `Listed ${path}`;
    } else if (at === 'file_search') {
      const results = Array.isArray(r?.results)
        ? r.results.filter((item): item is { path?: string; name?: string; snippet?: string } => typeof item === 'object' && item !== null)
        : [];
      chips.push(`${results.length} results`);
      preview = results
        .slice(0, 6)
        .map((resultItem) => {
          const label = resultItem.path || resultItem.name || 'Unknown file';
          const snippet = typeof resultItem.snippet === 'string' && resultItem.snippet ? `\n  ${resultItem.snippet}` : '';
          return `${label}${snippet}`;
        })
        .join('\n');
      summary = desc || `Found ${results.length} file(s)`;
    } else if (at === 'dir_create' || at === 'dir_delete') {
      const path = typeof r?.path === 'string' ? r.path : '';
      if (path) chips.push(fname(path) || path);
      summary = desc || `${at === 'dir_delete' ? 'Deleted' : 'Created'} directory`;
    } else if (at === 'file_move' || at === 'file_copy') {
      summary = desc || `${at === 'file_copy' ? 'Copied' : 'Moved'} file`;
    } else if (at === 'file_exists') {
      const path = typeof r?.path === 'string' ? r.path : '';
      if (path) chips.push(fname(path));
      if (typeof r?.exists === 'boolean') chips.push(r.exists ? 'exists' : 'missing');
      summary = desc || 'File status';
    } else if (at === 'system_info') {
      if (typeof r?.os === 'string') chips.push(r.os);
      if (typeof r?.memory_percent === 'number') chips.push(`RAM ${r.memory_percent}%`);
      if (typeof r?.disk_percent === 'number') chips.push(`Disk ${r.disk_percent}%`);
      preview = [
        typeof r?.hostname === 'string' ? `Host: ${r.hostname}` : '',
        typeof r?.cpu_count === 'number' ? `CPU cores: ${r.cpu_count}` : '',
        typeof r?.memory_total_gb === 'number' ? `RAM total: ${r.memory_total_gb} GB` : '',
        typeof r?.disk_free_gb === 'number' && typeof r?.disk_total_gb === 'number'
          ? `Disk free: ${r.disk_free_gb} / ${r.disk_total_gb} GB`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
      summary = desc || 'System information';
    } else if (at === 'shell' || at === 'dc_shell') {
      const cmd = typeof r?.command === 'string' ? r.command : '';
      const exit = typeof r?.exit_code === 'number' ? r.exit_code : (typeof r?.success === 'boolean' ? (r.success ? 0 : 1) : null);
      chips.push(`exit ${exit ?? '?'}`);
      if (exit !== null && exit !== 0) chips.push('error');
      shellOut = typeof r?.stdout === 'string' ? trunc(r.stdout, 600) : '';
      const stderr = typeof r?.stderr === 'string' ? r.stderr : '';
      if (!shellOut && stderr) shellOut = trunc(stderr, 300);
      summary = trunc(cmd, 80);
    } else if (at.startsWith('browser_')) {
      const url = typeof r?.url === 'string' ? r.url : '';
      const title = typeof r?.title === 'string' ? r.title : '';
      if (url) {
        try {
          chips.push(new URL(url).host);
        } catch {
          chips.push(url);
        }
      }
      if (title) preview = title;
      summary = desc || entry.action;
    } else if (at.startsWith('web_')) {
      const q = typeof r?.query === 'string' ? r.query : '';
      if (q) chips.push(`"${trunc(q, 40)}"`);
      summary = desc || entry.action;
    }

    return { summary, preview, chips, shellOut };
  }, [entry]);

interface ChatMessageProps {
  entry: LogEntry;
  onAskReply?: (entryId: string, answer: string) => void;
}

const ChatMessage = ({ entry, onAskReply }: ChatMessageProps) => {
  const [askInput, setAskInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const cfg = TYPE_CFG[entry.type] ?? TYPE_CFG.act;
  const ToolIcon = entry.actionType && FILE_ICON[entry.actionType] ? FILE_ICON[entry.actionType] : cfg.icon;
  const { summary, preview, chips, shellOut } = useToolHighlights(entry);
  const stepTitle = entry.toolLabel || cfg.label;
  const stepSubtitle = summary !== stepTitle ? summary : '';
  const shouldShowInlineSubtitle =
    !!stepSubtitle && !['file', 'shell'].includes(entry.type) && entry.actionType !== 'dc_shell';

  const isResult = entry.type === 'result';
  const isThinking = entry.type === 'thinking';
  const isAsk = entry.type === 'ask';
  const isInfo = entry.type === 'info';
  const isError = entry.type === 'error';
  const isStep = !isResult && !isInfo && !isAsk && !isError;

  const { text: displayText, artifacts: parsedArtifacts } = isResult
    ? parseArtifacts(entry.action)
    : { text: entry.action, artifacts: [] };
  const artifacts = parsedArtifacts.filter((a) => a.type !== 'terminal');

  const hasExpandable = !!(entry.reasoning || preview || shellOut || (entry.tool_result && isStep));

  if (isThinking) {
    return (
      <div className="log-entry-enter flex gap-3 py-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-400/10">
          <Brain size={14} className="text-purple-400" />
        </div>
        <div className="min-w-0 flex-1">
          <button
            onClick={() => setExpanded((o) => !o)}
            className="flex items-center gap-2 text-xs text-purple-300/80 transition-colors hover:text-purple-200"
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span className="italic">Thinking…</span>
          </button>
          {expanded && entry.reasoning && (
            <div className="mt-2 rounded-xl border border-purple-400/15 bg-purple-400/5 px-4 py-3">
              <p className="whitespace-pre-wrap text-xs italic leading-6 text-white/60">{entry.reasoning}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isResult) {
    return (
      <div className="log-entry-enter flex gap-3 py-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/12">
          <Sparkles size={14} className="text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-[20px] border border-emerald-400/12 bg-[linear-gradient(180deg,rgba(18,32,26,0.97),rgba(12,20,18,0.97))] shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
            <div className="px-5 py-4">
              {displayText && renderMd(displayText)}
              {artifacts.length > 0 && (
                <div className="mt-4 space-y-2">
                  {artifacts.map((a) => <ArtifactCard key={a.id} artifact={a} />)}
                </div>
              )}
              {entry.attachments && entry.attachments.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {entry.attachments.map((f, i) => (
                    <a
                      key={i}
                      href={f.url || '#'}
                      download={f.name}
                      className="flex w-fit items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary hover:text-primary/80"
                    >
                      <Download size={13} />
                      <Paperclip size={12} />
                      <span>{f.name}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isInfo && entry.step === 0) {
    return (
      <div className="log-entry-enter flex gap-3 py-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <span className="text-xs font-medium text-primary">U</span>
        </div>
        <div className="flex-1">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">You</span>
          <p className="whitespace-pre-wrap text-sm text-foreground">{entry.action}</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="log-entry-enter flex gap-3 py-2">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
          <AlertTriangle size={14} className="text-destructive" />
        </div>
        <div className="min-w-0 flex-1 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{entry.action}</p>
        </div>
      </div>
    );
  }

  if (isAsk) {
    return (
      <div className="log-entry-enter flex gap-3 py-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15">
          <MessageCircleQuestion size={14} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1 rounded-[18px] border border-accent/20 bg-accent/5 px-4 py-3">
          <p className="mb-3 text-sm text-foreground">{entry.action}</p>
          {!entry.askResolved && (
            entry.askOptions?.length ? (
              <div className="flex flex-wrap gap-2">
                {entry.askOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => onAskReply?.(entry.id, opt)}
                    className="rounded-xl border border-accent/20 bg-accent/15 px-3 py-1.5 text-xs text-accent hover:bg-accent/25 active:scale-[0.97]"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={askInput}
                  onChange={(e) => setAskInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && askInput.trim()) {
                      onAskReply?.(entry.id, askInput.trim());
                      setAskInput('');
                    }
                  }}
                  placeholder="Your answer…"
                  className="flex-1 rounded-xl border border-border bg-muted px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={() => {
                    if (askInput.trim()) {
                      onAskReply?.(entry.id, askInput.trim());
                      setAskInput('');
                    }
                  }}
                  className="rounded-xl bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90"
                >
                  Reply
                </button>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  const isDcShell = entry.actionType === 'dc_shell' || entry.actionType === 'shell';
  const exitCode = isDcShell && entry.tool_result
    ? ((entry.tool_result as { exit_code?: number; success?: boolean }).exit_code
        ?? ((entry.tool_result as { success?: boolean }).success === false ? 1 : 0))
    : null;
  const exitOk = exitCode === null || exitCode === 0;

  return (
    <div className="log-entry-enter flex gap-2.5 py-1">
      <div className="flex flex-col items-center">
        <div className={`mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${cfg.pill}`}>
          <ToolIcon size={12} className={exitOk ? '' : 'text-red-400'} />
        </div>
        {hasExpandable && expanded && <div className="mt-1 min-h-[8px] w-px flex-1 bg-white/8" />}
      </div>

      <div className="min-w-0 flex-1 pb-1">
        <button
          onClick={() => hasExpandable && setExpanded((o) => !o)}
          className={`flex w-full items-start gap-2 text-left ${hasExpandable ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium text-foreground/90">{stepTitle}</span>
              {chips.map((c) => (
                <span
                  key={c}
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-mono ${
                    c === 'error' || c.includes('error') ? 'bg-red-400/10 text-red-300' : 'bg-white/6 text-white/54'
                  }`}
                >
                  {c}
                </span>
              ))}
              {entry.step > 0 && <span className="ml-auto shrink-0 text-[11px] tabular-nums text-white/30">#{entry.step}</span>}
            </div>
            {shouldShowInlineSubtitle && (
              <span className="mt-0.5 block text-[11px] text-white/42">{stepSubtitle}</span>
            )}
          </div>
          {hasExpandable && (
            <span className="mt-1 shrink-0 text-white/30 transition-colors hover:text-white/60">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
          )}
        </button>

        {expanded && hasExpandable && (
          <div className="mt-2 space-y-2">
            {(shellOut || (isDcShell && !exitOk)) && (
              <div className={`overflow-hidden rounded-xl border ${exitOk ? 'border-green-400/12 bg-black/30' : 'border-red-400/15 bg-red-950/20'}`}>
                <div className={`flex items-center gap-2 border-b px-3 py-1.5 ${exitOk ? 'border-green-400/10 bg-black/20' : 'border-red-400/10'}`}>
                  <Terminal size={10} className={exitOk ? 'text-green-400/60' : 'text-red-400/60'} />
                  <span className={`text-[10px] font-mono ${exitOk ? 'text-green-400/60' : 'text-red-400/60'}`}>
                    {exitOk ? 'stdout' : `exit ${exitCode}`}
                  </span>
                </div>
                <pre className="scrollbar-thin max-h-64 overflow-y-auto whitespace-pre-wrap px-4 py-3 font-mono text-[11.5px] leading-5 text-white/70">
                  {shellOut || 'Command failed with no output.'}
                </pre>
              </div>
            )}

            {preview && !isDcShell && (
              <div className="overflow-hidden rounded-xl border border-amber-400/10 bg-black/20">
                <div className="flex items-center gap-2 border-b border-amber-400/8 bg-black/10 px-3 py-1.5">
                  <FileText size={10} className="text-amber-400/50" />
                  <span className="text-[10px] font-mono text-amber-400/50">output</span>
                </div>
                <pre className="scrollbar-thin max-h-56 overflow-y-auto whitespace-pre-wrap px-4 py-3 font-mono text-[11.5px] leading-5 text-white/68">
                  {preview}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
