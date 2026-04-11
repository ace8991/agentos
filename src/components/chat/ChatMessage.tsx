import { useMemo, useState } from 'react';
import {
  AlertTriangle, Brain, CheckCircle, ChevronDown, ChevronRight,
  Code, Download, Eye, FileText, FilePen, FolderOpen, FolderSearch,
  Globe, Info, Loader2, MessageCircleQuestion, MousePointer,
  Paperclip, Search, Sparkles, Terminal, Zap,
} from 'lucide-react';
import { type LogEntry, type LogType } from '@/store/useStore';
import { parseArtifacts } from '@/lib/artifacts';
import ArtifactCard from './ArtifactCard';

// ─── Type → icon/label/color ─────────────────────────────────────────
const TYPE_CFG: Record<LogType, { icon: typeof Eye; label: string; color: string; pill: string }> = {
  perceive:  { icon: Eye,                  label: 'Observing',      color: 'text-primary',          pill: 'bg-primary/10 text-primary'        },
  plan:      { icon: Brain,               label: 'Planning',       color: 'text-purple-400',        pill: 'bg-purple-400/10 text-purple-300'  },
  act:       { icon: MousePointer,        label: 'Acting',         color: 'text-accent',            pill: 'bg-accent/10 text-accent'          },
  verify:    { icon: CheckCircle,         label: 'Verifying',      color: 'text-emerald-400',       pill: 'bg-emerald-400/10 text-emerald-300'},
  done:      { icon: CheckCircle,         label: 'Done',           color: 'text-success',           pill: 'bg-success/10 text-success'        },
  error:     { icon: AlertTriangle,       label: 'Error',          color: 'text-destructive',       pill: 'bg-destructive/10 text-destructive'},
  browser:   { icon: Globe,              label: 'Browser',        color: 'text-sky-400',           pill: 'bg-sky-400/10 text-sky-300'        },
  web:       { icon: Search,             label: 'Web search',     color: 'text-blue-400',          pill: 'bg-blue-400/10 text-blue-300'      },
  shell:     { icon: Terminal,           label: 'Terminal',       color: 'text-green-400',         pill: 'bg-green-400/10 text-green-300'    },
  info:      { icon: Info,              label: 'Info',           color: 'text-muted-foreground',  pill: 'bg-muted text-muted-foreground'    },
  thinking:  { icon: Loader2,           label: 'Thinking',       color: 'text-purple-400',        pill: 'bg-purple-400/10 text-purple-300'  },
  ask:       { icon: MessageCircleQuestion, label: 'Question',    color: 'text-accent',            pill: 'bg-accent/10 text-accent'          },
  result:    { icon: Sparkles,          label: 'Result',         color: 'text-emerald-400',       pill: 'bg-emerald-400/10 text-emerald-300'},
  file:      { icon: FolderOpen,        label: 'File system',    color: 'text-amber-400',         pill: 'bg-amber-400/10 text-amber-300'    },
};

// ─── File action sub-icons ────────────────────────────────────────────
const FILE_ICON: Record<string, typeof Eye> = {
  file_read: FileText, file_write: FilePen, file_edit: FilePen,
  file_list: FolderOpen, file_create_dir: FolderOpen,
  file_search: FolderSearch, file_move: FolderOpen,
  file_info: FileText, dc_shell: Terminal,
};

// ─── Helpers ──────────────────────────────────────────────────────────
const trunc = (v: string, max = 300) => {
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
};
const fname = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() || p;

// ─── Markdown renderer (Claude-style) ────────────────────────────────
const renderMd = (text: string) => {
  if (!text?.trim()) return null;
  const blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  return (
    <div className="space-y-3 text-[15px] leading-7">
      {blocks.map((block, bi) => {
        // Code block
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
              <pre className="p-4 overflow-x-auto text-[12.5px] font-mono text-white/85 leading-6 whitespace-pre-wrap">{code}</pre>
            </div>
          );
        }
        // Heading
        const h3 = block.match(/^### (.+)/);
        const h2 = block.match(/^## (.+)/);
        const h1 = block.match(/^# (.+)/);
        if (h1) return <h1 key={bi} className="text-lg font-semibold text-white mt-2">{h1[1]}</h1>;
        if (h2) return <h2 key={bi} className="text-base font-semibold text-white/95 mt-1.5">{h2[1]}</h2>;
        if (h3) return <h3 key={bi} className="text-sm font-semibold text-white/90 uppercase tracking-wide mt-1">{h3[1]}</h3>;
        // Horizontal rule
        if (block === '---' || block === '***') return <hr key={bi} className="border-white/10" />;
        // List
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.every(l => /^[-*+]\s/.test(l))) {
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
        // Numbered list
        if (lines.every(l => /^\d+\.\s/.test(l))) {
          return (
            <ol key={bi} className="space-y-1.5 pl-1">
              {lines.map((l, li) => (
                <li key={li} className="flex items-start gap-2.5">
                  <span className="shrink-0 text-[11px] font-mono text-emerald-400/70 mt-1">{li + 1}.</span>
                  <span className="text-white/85">{renderInline(l.replace(/^\d+\.\s/, ''))}</span>
                </li>
              ))}
            </ol>
          );
        }
        // Blockquote
        if (lines.every(l => l.startsWith('> '))) {
          return (
            <blockquote key={bi} className="border-l-2 border-white/20 pl-4 italic text-white/68">
              {lines.map(l => l.slice(2)).join(' ')}
            </blockquote>
          );
        }
        // **Bold label** standalone
        if (lines.length === 1 && /^\*\*[^*]+\*\*$/.test(lines[0])) {
          return (
            <p key={bi} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300/70 mt-1">
              {lines[0].slice(2, -2)}
            </p>
          );
        }
        // Normal paragraph
        return (
          <p key={bi} className="text-white/88 leading-7">{renderInline(block)}</p>
        );
      })}
    </div>
  );
};

const renderInline = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-white/96">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i} className="italic text-white/82">{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-sky-200">{part.slice(1, -1)}</code>;
    const m = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (m)
      return <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline-offset-2 hover:underline">{m[1]}</a>;
    return <span key={i}>{part}</span>;
  });
};

// ─── Tool highlights for all action types ────────────────────────────
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

    // ── File operations ──────────────────────────────────────────────
    if (at === 'file_read') {
      const path = typeof r?.path === 'string' ? r.path : '';
      if (path) chips.push(fname(path));
      if (typeof r?.lines_read === 'number') chips.push(`${r.lines_read} lines`);
      if (r?.truncated) chips.push('truncated');
      preview = typeof r?.content === 'string' ? trunc(r.content, 500) : '';
      summary = desc || `Read ${path ? fname(path) : 'file'}`;
    } else if (at === 'file_write') {
      const path = typeof r?.path === 'string' ? r.path : '';
      if (path) chips.push(fname(path));
      if (typeof r?.lines_written === 'number') chips.push(`${r.lines_written} lines written`);
      summary = desc || `Wrote ${path ? fname(path) : 'file'}`;
    } else if (at === 'file_edit') {
      const path = typeof r?.path === 'string' ? r.path : '';
      if (path) chips.push(fname(path));
      if (typeof r?.replacements === 'number') chips.push(`${r.replacements} edit(s)`);
      summary = desc || `Edited ${path ? fname(path) : 'file'}`;
    } else if (at === 'file_list') {
      const path = typeof r?.path === 'string' ? r.path : '';
      if (path) chips.push(fname(path) || path);
      const entries = Array.isArray(r?.entries) ? r.entries : [];
      chips.push(`${entries.length} items`);
      preview = entries.slice(0, 8).map((e: any) => `${e.type === 'directory' ? '📁' : '📄'} ${e.name}`).join('\n');
      summary = desc || `Listed ${path}`;
    } else if (at === 'file_search') {
      const results = Array.isArray(r?.results) ? r.results : [];
      chips.push(`${results.length} results`);
      preview = results.slice(0, 6).join('\n');
      summary = desc || `Found ${results.length} file(s)`;
    } else if (at === 'file_create_dir') {
      const path = typeof r?.path === 'string' ? r.path : '';
      if (path) chips.push(fname(path) || path);
      summary = desc || `Created directory`;
    } else if (at === 'file_move') {
      summary = desc || 'Moved file';
    } else if (at === 'file_info') {
      const path = typeof r?.path === 'string' ? r.path : '';
      if (path) chips.push(fname(path));
      if (typeof r?.size === 'number') chips.push(`${(r.size / 1024).toFixed(1)} KB`);
      summary = desc || `File info`;
    }
    // ── Terminal ─────────────────────────────────────────────────────
    else if (at === 'dc_shell' || at === 'shell') {
      const cmd = typeof r?.command === 'string' ? r.command : entry.action;
      const exit = typeof r?.exit_code === 'number' ? r.exit_code : null;
      chips.push(`exit ${exit ?? '?'}`);
      if (exit !== null && exit !== 0) chips.push('error');
      shellOut = typeof r?.stdout === 'string' ? trunc(r.stdout, 600) : '';
      const stderr = typeof r?.stderr === 'string' ? r.stderr : '';
      if (!shellOut && stderr) shellOut = trunc(stderr, 300);
      summary = trunc(cmd, 80);
    }
    // ── Browser ──────────────────────────────────────────────────────
    else if (at?.startsWith('browser_')) {
      const url = typeof r?.url === 'string' ? r.url : '';
      const title = typeof r?.title === 'string' ? r.title : '';
      if (url) { try { chips.push(new URL(url).host); } catch { chips.push(url); } }
      if (title) preview = title;
      summary = desc || entry.action;
    }
    // ── Web search ───────────────────────────────────────────────────
    else if (at?.startsWith('web_')) {
      const q = typeof r?.query === 'string' ? r.query : '';
      if (q) chips.push(`"${trunc(q, 40)}"`);
      summary = desc || entry.action;
    }

    return { summary, preview, chips, shellOut };
  }, [entry]);

// ─── Main component ───────────────────────────────────────────────────
interface ChatMessageProps {
  entry: LogEntry;
  onAskReply?: (entryId: string, answer: string) => void;
}

const ChatMessage = ({ entry, onAskReply }: ChatMessageProps) => {
  const [askInput, setAskInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const cfg = TYPE_CFG[entry.type] ?? TYPE_CFG.act;
  const ToolIcon = entry.actionType && FILE_ICON[entry.actionType]
    ? FILE_ICON[entry.actionType]
    : cfg.icon;
  const { summary, preview, chips, shellOut } = useToolHighlights(entry);

  const isResult   = entry.type === 'result';
  const isThinking = entry.type === 'thinking';
  const isAsk      = entry.type === 'ask';
  const isInfo     = entry.type === 'info';
  const isError    = entry.type === 'error';
  const isStep     = !isResult && !isInfo && !isAsk && !isError;

  const { text: displayText, artifacts: parsedArtifacts } = isResult
    ? parseArtifacts(entry.action)
    : { text: entry.action, artifacts: [] };
  const artifacts = parsedArtifacts.filter(a => a.type !== 'terminal');

  const hasExpandable = !!(entry.reasoning || preview || shellOut || (entry.tool_result && isStep));

  // ─── THINKING block (Claude-style collapsible) ────────────────────
  if (isThinking) {
    return (
      <div className="flex gap-3 py-2 log-entry-enter">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-400/10">
          <Brain size={14} className="text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setExpanded(o => !o)}
            className="flex items-center gap-2 text-xs text-purple-300/80 hover:text-purple-200 transition-colors"
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span className="italic">Thinking…</span>
          </button>
          {expanded && entry.reasoning && (
            <div className="mt-2 rounded-xl border border-purple-400/15 bg-purple-400/5 px-4 py-3">
              <p className="text-xs italic leading-6 text-white/60 whitespace-pre-wrap">{entry.reasoning}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── RESULT block (final AI response) ────────────────────────────
  if (isResult) {
    return (
      <div className="flex gap-3 py-3 log-entry-enter">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/12">
          <Sparkles size={14} className="text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="overflow-hidden rounded-[20px] border border-emerald-400/12 bg-[linear-gradient(180deg,rgba(18,32,26,0.97),rgba(12,20,18,0.97))] shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
            <div className="px-5 py-4">
              {displayText && renderMd(displayText)}
              {artifacts.length > 0 && (
                <div className="mt-4 space-y-2">
                  {artifacts.map(a => <ArtifactCard key={a.id} artifact={a} />)}
                </div>
              )}
              {entry.attachments && entry.attachments.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {entry.attachments.map((f, i) => (
                    <a key={i} href={f.url || '#'} download={f.name}
                      className="flex w-fit items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary hover:text-primary/80">
                      <Download size={13} /><Paperclip size={12} /><span>{f.name}</span>
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

  // ─── USER / INFO message ─────────────────────────────────────────
  if (isInfo && entry.step === 0) {
    return (
      <div className="flex gap-3 py-3 log-entry-enter">
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

  // ─── ERROR block ─────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex gap-3 py-2 log-entry-enter">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
          <AlertTriangle size={14} className="text-destructive" />
        </div>
        <div className="flex-1 min-w-0 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{entry.action}</p>
        </div>
      </div>
    );
  }

  // ─── ASK block ───────────────────────────────────────────────────
  if (isAsk) {
    return (
      <div className="flex gap-3 py-3 log-entry-enter">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15">
          <MessageCircleQuestion size={14} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0 rounded-[18px] border border-accent/20 bg-accent/5 px-4 py-3">
          <p className="mb-3 text-sm text-foreground">{entry.action}</p>
          {!entry.askResolved && (
            entry.askOptions?.length ? (
              <div className="flex flex-wrap gap-2">
                {entry.askOptions.map((opt, i) => (
                  <button key={i} onClick={() => onAskReply?.(entry.id, opt)}
                    className="rounded-xl border border-accent/20 bg-accent/15 px-3 py-1.5 text-xs text-accent hover:bg-accent/25 active:scale-[0.97]">
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={askInput} onChange={e => setAskInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && askInput.trim()) { onAskReply?.(entry.id, askInput.trim()); setAskInput(''); } }}
                  placeholder="Your answer…"
                  className="flex-1 rounded-xl border border-border bg-muted px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
                <button onClick={() => { if (askInput.trim()) { onAskReply?.(entry.id, askInput.trim()); setAskInput(''); } }}
                  className="rounded-xl bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90">
                  Reply
                </button>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  // ─── STEP / TOOL-USE block (Claude-style) ────────────────────────
  const isDcShell = entry.actionType === 'dc_shell' || entry.actionType === 'shell';
  const exitCode = isDcShell && entry.tool_result ? (entry.tool_result as any).exit_code : null;
  const exitOk = exitCode === null || exitCode === 0;

  return (
    <div className="flex gap-2.5 py-1 log-entry-enter">
      {/* Step indicator line */}
      <div className="flex flex-col items-center">
        <div className={`mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${cfg.pill}`}>
          <ToolIcon size={12} className={exitOk ? '' : 'text-red-400'} />
        </div>
        {hasExpandable && expanded && (
          <div className="mt-1 flex-1 w-px bg-white/8 min-h-[8px]" />
        )}
      </div>

      <div className="flex-1 min-w-0 pb-1">
        {/* Tool call header — always visible */}
        <button
          onClick={() => hasExpandable && setExpanded(o => !o)}
          className={`flex w-full items-start gap-2 text-left ${hasExpandable ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm text-foreground/90 font-medium">{summary}</span>
              {chips.map(c => (
                <span key={c} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-mono ${
                  c === 'error' || c.includes('error') ? 'bg-red-400/10 text-red-300' : 'bg-white/6 text-white/54'
                }`}>{c}</span>
              ))}
              {entry.step > 0 && (
                <span className="ml-auto text-[11px] text-white/30 tabular-nums shrink-0">#{entry.step}</span>
              )}
            </div>
            {entry.toolLabel && entry.toolLabel !== summary && (
              <span className="text-[11px] text-white/40 mt-0.5 block">{entry.toolLabel}</span>
            )}
          </div>
          {hasExpandable && (
            <span className="shrink-0 mt-1 text-white/30 hover:text-white/60 transition-colors">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
          )}
        </button>

        {/* Expanded details */}
        {expanded && hasExpandable && (
          <div className="mt-2 space-y-2">
            {/* Shell stdout */}
            {(shellOut || (isDcShell && !exitOk)) && (
              <div className={`rounded-xl border overflow-hidden ${exitOk ? 'border-green-400/12 bg-black/30' : 'border-red-400/15 bg-red-950/20'}`}>
                <div className={`flex items-center gap-2 px-3 py-1.5 border-b ${exitOk ? 'border-green-400/10 bg-black/20' : 'border-red-400/10'}`}>
                  <Terminal size={10} className={exitOk ? 'text-green-400/60' : 'text-red-400/60'} />
                  <span className={`text-[10px] font-mono ${exitOk ? 'text-green-400/60' : 'text-red-400/60'}`}>
                    {exitOk ? 'stdout' : `exit ${exitCode}`}
                  </span>
                </div>
                <pre className="px-4 py-3 text-[11.5px] font-mono leading-5 text-white/70 whitespace-pre-wrap max-h-64 overflow-y-auto scrollbar-thin">
                  {shellOut || 'Command failed with no output.'}
                </pre>
              </div>
            )}

            {/* File content preview */}
            {preview && !isDcShell && (
              <div className="rounded-xl border border-amber-400/10 bg-black/20 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-amber-400/8 bg-black/10">
                  <FileText size={10} className="text-amber-400/50" />
                  <span className="text-[10px] font-mono text-amber-400/50">output</span>
                </div>
                <pre className="px-4 py-3 text-[11.5px] font-mono leading-5 text-white/68 whitespace-pre-wrap max-h-56 overflow-y-auto scrollbar-thin">
                  {preview}
                </pre>
              </div>
            )}

            {/* Reasoning */}
            {entry.reasoning && (
              <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40 mb-1.5">Reasoning</p>
                <p className="text-xs leading-5 text-white/58 whitespace-pre-wrap italic">{entry.reasoning}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
