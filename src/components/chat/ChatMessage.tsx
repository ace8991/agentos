import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Globe,
  HardDrive,
  Info,
  Loader2,
  MessageCircleQuestion,
  MousePointer,
  Paperclip,
  Search,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { type LogEntry, type LogType } from '@/store/useStore';
import { parseArtifacts } from '@/lib/artifacts';
import ArtifactCard from './ArtifactCard';

const typeConfig: Record<LogType, { icon: typeof Eye; label: string; color: string }> = {
  perceive: { icon: Eye, label: 'Perceiving', color: 'text-primary' },
  plan: { icon: Brain, label: 'Planning', color: 'text-secondary' },
  act: { icon: MousePointer, label: 'Acting', color: 'text-accent' },
  verify: { icon: CheckCircle, label: 'Verifying', color: 'text-secondary' },
  done: { icon: CheckCircle, label: 'Completed', color: 'text-success' },
  error: { icon: AlertTriangle, label: 'Error', color: 'text-destructive' },
  browser: { icon: Globe, label: 'Navigating web', color: 'text-secondary' },
  web: { icon: Search, label: 'Web search', color: 'text-primary' },
  shell: { icon: Terminal, label: 'Terminal', color: 'text-accent' },
  info: { icon: Info, label: 'Info', color: 'text-muted-foreground' },
  thinking: { icon: Loader2, label: 'Thinking', color: 'text-primary' },
  ask: { icon: MessageCircleQuestion, label: 'Question', color: 'text-accent' },
  result: { icon: FileText, label: 'Result', color: 'text-success' },
};

interface ChatMessageProps {
  entry: LogEntry;
  onAskReply?: (entryId: string, answer: string) => void;
}

const truncateText = (value: string, max = 240) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileNameFromPath = (path: string) => {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] || path;
};

const renderInlineFragments = (text: string, keyPrefix: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-${index}`} className="font-semibold text-white/94">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={`${keyPrefix}-${index}`}
          className="rounded bg-white/8 px-1.5 py-0.5 font-mono text-[12px] text-sky-100"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      return (
        <a
          key={`${keyPrefix}-${index}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-200 underline-offset-4 transition-colors hover:text-sky-100 hover:underline"
        >
          {linkMatch[1]}
        </a>
      );
    }

    return <span key={`${keyPrefix}-${index}`}>{part}</span>;
  });
};

const renderStructuredText = (text: string) => {
  if (!text.trim()) return null;

  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        const lines = block
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        const isList = lines.length > 0 && lines.every((line) => line.startsWith('- '));
        const isStandaloneLabel =
          lines.length === 1 &&
          lines[0].startsWith('**') &&
          lines[0].endsWith('**');

        if (isStandaloneLabel) {
          return (
            <div
              key={`block-${blockIndex}`}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100/72"
            >
              {lines[0].slice(2, -2)}
            </div>
          );
        }

        if (isList) {
          return (
            <ul key={`block-${blockIndex}`} className="space-y-1.5">
              {lines.map((line, lineIndex) => (
                <li key={`line-${lineIndex}`} className="flex items-start gap-2 text-sm leading-6 text-white/84">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300/80" />
                  <span>{renderInlineFragments(line.slice(2), `list-${blockIndex}-${lineIndex}`)}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`block-${blockIndex}`} className="text-sm leading-7 text-white/88">
            {renderInlineFragments(block, `paragraph-${blockIndex}`)}
          </p>
        );
      })}
    </div>
  );
};

const ChatMessage = ({ entry, onAskReply }: ChatMessageProps) => {
  const [askInput, setAskInput] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const config = typeConfig[entry.type] || typeConfig.act;
  const Icon = config.icon;

  const isThinking = entry.type === 'thinking';
  const isAsk = entry.type === 'ask';
  const isResult = entry.type === 'result';
  const isInfo = entry.type === 'info';
  const isError = entry.type === 'error';

  const { text: displayText, artifacts } = isResult
    ? parseArtifacts(entry.action)
    : { text: entry.action, artifacts: [] };

  const toolHighlights = useMemo(() => {
    const result = entry.tool_result;
    if (!result) {
      return {
        summary: '',
        preview: '',
        chips: [] as string[],
      };
    }

    const description = typeof result.description === 'string' ? result.description : '';
    const path = typeof result.path === 'string' ? result.path : '';
    const content = typeof result.content === 'string' ? result.content : '';
    const items = Array.isArray(result.items)
      ? result.items.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      : [];
    const results = Array.isArray(result.results)
      ? result.results.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      : [];
    const chips: string[] = [];
    let preview = '';
    let summary = description;

    if (entry.actionType === 'file_read') {
      if (path) chips.push(fileNameFromPath(path));
      if (typeof result.size_bytes === 'number') chips.push(formatBytes(result.size_bytes));
      if (result.truncated === true) chips.push('Partial preview');
      if (content) preview = truncateText(content, 420);
      summary = description || 'File read completed.';
    } else if (entry.actionType === 'file_search') {
      chips.push(`${results.length} match${results.length === 1 ? '' : 'es'}`);
      const first = results[0];
      if (first && typeof first.name === 'string') chips.push(first.name);
      if (first && typeof first.snippet === 'string') preview = truncateText(first.snippet, 240);
      summary = description || 'File search completed.';
    } else if (entry.actionType === 'dir_list') {
      if (path) chips.push(fileNameFromPath(path));
      chips.push(`${typeof result.total === 'number' ? result.total : items.length} item${items.length === 1 ? '' : 's'}`);
      if (items.length > 0) {
        const visibleItems = items
          .slice(0, 5)
          .map((item) => (typeof item.name === 'string' ? item.name : null))
          .filter(Boolean);
        if (visibleItems.length > 0) {
          preview = visibleItems.join(', ');
        }
      }
      summary = description || 'Directory contents loaded.';
    } else if (entry.actionType === 'system_info') {
      if (typeof result.os === 'string') chips.push(result.os);
      if (typeof result.memory_percent === 'number') chips.push(`RAM ${result.memory_percent}%`);
      if (typeof result.disk_percent === 'number') chips.push(`Disk ${result.disk_percent}%`);
      summary = description || 'System information collected.';
    } else if (entry.actionType === 'process_list') {
      chips.push(`${typeof result.total === 'number' ? result.total : 0} processes`);
      summary = description || 'Process list collected.';
    } else if (
      entry.actionType === 'shell' ||
      entry.actionType === 'terminal_open' ||
      entry.actionType === 'app_open'
    ) {
      summary = description || entry.action;
    }

    return {
      summary,
      preview,
      chips,
    };
  }, [entry.action, entry.actionType, entry.tool_result]);

  const shellDetail =
    entry.actionType === 'shell' &&
    entry.tool_result &&
    typeof entry.tool_result.stdout === 'string' &&
    entry.tool_result.stdout.trim()
      ? truncateText(entry.tool_result.stdout, 700)
      : '';
  const detailPreview = toolHighlights.preview || shellDetail;
  const hasDetails = Boolean(entry.reasoning?.trim() || entry.tool_result);
  const containerClass = isResult
    ? 'border border-emerald-400/14 bg-[linear-gradient(180deg,rgba(24,36,32,0.96),rgba(15,22,20,0.96))] shadow-[0_18px_60px_rgba(0,0,0,0.22)]'
    : isError
    ? 'border border-destructive/18 bg-[rgba(44,15,18,0.56)]'
    : 'border border-white/8 bg-white/[0.03]';
  const contentClass = isResult ? 'px-4 py-4 md:px-5' : 'px-4 py-3.5';

  return (
    <div className="flex gap-3 py-3 log-entry-enter">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          isResult ? 'bg-emerald-400/14' : isAsk ? 'bg-accent/15' : isInfo ? 'bg-muted' : 'bg-surface-elevated'
        }`}
      >
        <Icon size={14} className={`${config.color} ${isThinking ? 'animate-spin' : ''}`} />
      </div>

      <div className="min-w-0 flex-1">
        <div className={`overflow-hidden rounded-[22px] ${containerClass}`}>
          <div className={contentClass}>
            <div className="mb-2 flex items-center gap-2">
              <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${config.color}`}>
                {isResult ? 'Final result' : config.label}
              </span>
              {entry.toolLabel && (
                <>
                  <span className="text-[11px] text-muted-foreground">/</span>
                  <span className="text-[11px] text-muted-foreground">{entry.toolLabel}</span>
                </>
              )}
              {entry.step > 0 && (
                <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">Step {entry.step}</span>
              )}
            </div>

            {toolHighlights.summary && !isResult && toolHighlights.summary !== displayText && (
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-xs text-white/74">
                <Sparkles size={12} className="text-sky-200/80" />
                <span>{toolHighlights.summary}</span>
              </div>
            )}

            {displayText && (
              <div className={isResult ? '' : 'space-y-2'}>
                {isResult ? (
                  renderStructuredText(displayText)
                ) : (
                  <p className="break-words whitespace-pre-wrap text-sm leading-7 text-foreground">
                    {displayText}
                  </p>
                )}
              </div>
            )}

            {!isResult && toolHighlights.chips.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {toolHighlights.chips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/68"
                  >
                    {entry.actionType === 'dir_list' ? <FolderOpen size={11} /> : <HardDrive size={11} />}
                    {chip}
                  </span>
                ))}
              </div>
            )}

            {artifacts.length > 0 && (
              <div className="mt-4 space-y-2">
                {artifacts.map((artifact) => (
                  <ArtifactCard key={artifact.id} artifact={artifact} />
                ))}
              </div>
            )}

            {entry.attachments && entry.attachments.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {entry.attachments.map((file, index) => (
                  <a
                    key={index}
                    href={file.url || '#'}
                    download={file.name}
                    className="flex w-fit items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary transition-colors hover:text-primary/80"
                  >
                    <Download size={13} />
                    <Paperclip size={12} />
                    <span>{file.name}</span>
                  </a>
                ))}
              </div>
            )}

            {isAsk && !entry.askResolved && (
              <div className="mt-4 space-y-2">
                {entry.askOptions && entry.askOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {entry.askOptions.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => onAskReply?.(entry.id, option)}
                        className="rounded-xl border border-accent/20 bg-accent/15 px-3 py-1.5 text-xs text-accent transition-colors hover:bg-accent/25 active:scale-[0.97]"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={askInput}
                      onChange={(event) => setAskInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && askInput.trim()) {
                          onAskReply?.(entry.id, askInput.trim());
                          setAskInput('');
                        }
                      }}
                      placeholder="Type your answer..."
                      className="flex-1 rounded-xl border border-border bg-muted px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={() => {
                        if (askInput.trim()) {
                          onAskReply?.(entry.id, askInput.trim());
                          setAskInput('');
                        }
                      }}
                      className="rounded-xl bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.97]"
                    >
                      Reply
                    </button>
                  </div>
                )}
              </div>
            )}

            {hasDetails && (
              <div className="mt-4 border-t border-white/8 pt-3">
                <button
                  onClick={() => setDetailsOpen((open) => !open)}
                  className="inline-flex items-center gap-2 text-xs font-medium text-white/68 transition-colors hover:text-white"
                >
                  {detailsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {detailsOpen ? 'Hide step details' : 'View step details'}
                </button>

                {detailsOpen && (
                  <div className="mt-3 space-y-3">
                    {detailPreview && (
                      <div className="rounded-2xl border border-white/8 bg-black/15 p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/58">
                          Output preview
                        </div>
                        <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-white/76">
                          {detailPreview}
                        </pre>
                      </div>
                    )}

                    {entry.reasoning && (
                      <div className="rounded-2xl border border-white/8 bg-black/15 p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/58">
                          Internal step notes
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-white/74">
                          {entry.reasoning}
                        </p>
                      </div>
                    )}

                    {entry.tool_result && (
                      <div className="rounded-2xl border border-white/8 bg-black/15 p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/58">
                          Technical payload
                        </div>
                        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-white/70 scrollbar-thin">
                          {JSON.stringify(entry.tool_result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
