import { useState } from 'react';
import {
  Eye, Brain, MousePointer, CheckCircle, AlertTriangle, ChevronDown,
  Globe, Terminal, Search, Info, Loader2, MessageCircleQuestion,
  FileText, FolderOpen, FilePen, FolderSearch,
} from 'lucide-react';
import type { LogEntry, LogType } from '@/store/useStore';

const typeConfig: Record<LogType, { icon: typeof Eye; color: string; border: string; label: string }> = {
  perceive:  { icon: Eye,                color: 'text-primary',          border: 'border-l-primary',          label: 'Perceive'  },
  plan:      { icon: Brain,              color: 'text-secondary',        border: 'border-l-secondary',        label: 'Plan'      },
  act:       { icon: MousePointer,       color: 'text-accent',           border: 'border-l-accent',           label: 'Act'       },
  verify:    { icon: CheckCircle,        color: 'text-secondary',        border: 'border-l-secondary',        label: 'Verify'    },
  done:      { icon: CheckCircle,        color: 'text-success',          border: 'border-l-success',          label: 'Done'      },
  error:     { icon: AlertTriangle,      color: 'text-destructive',      border: 'border-l-destructive',      label: 'Error'     },
  browser:   { icon: Globe,             color: 'text-secondary',        border: 'border-l-secondary',        label: 'Browser'   },
  web:       { icon: Search,            color: 'text-primary',          border: 'border-l-primary',          label: 'Web'       },
  shell:     { icon: Terminal,          color: 'text-accent',           border: 'border-l-accent',           label: 'Shell'     },
  info:      { icon: Info,              color: 'text-muted-foreground', border: 'border-l-muted-foreground', label: 'Info'      },
  thinking:  { icon: Loader2,           color: 'text-primary',          border: 'border-l-primary',          label: 'Thinking'  },
  ask:       { icon: MessageCircleQuestion, color: 'text-accent',       border: 'border-l-accent',           label: 'Ask'       },
  result:    { icon: FileText,          color: 'text-success',          border: 'border-l-success',          label: 'Result'    },
  file:      { icon: FolderOpen,        color: 'text-primary-500',        border: 'border-l-primary-400',        label: 'File'      },
};

// Sub-icons for specific file action types
const fileActionIcon: Record<string, typeof Eye> = {
  file_read:       FileText,
  file_write:      FilePen,
  file_edit:       FilePen,
  file_list:       FolderOpen,
  file_create_dir: FolderOpen,
  file_search:     FolderSearch,
  file_move:       FolderOpen,
  file_info:       FileText,
};

const ActionLogEntry = ({ entry }: { entry: LogEntry }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = typeConfig[entry.type] ?? typeConfig.act;

  // For file actions, use the more specific icon
  const SpecificIcon = entry.actionType && fileActionIcon[entry.actionType]
    ? fileActionIcon[entry.actionType]
    : cfg.icon;

  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  // Detect file content to display inline
  const fileContent: string | null =
    entry.type === 'file' &&
    entry.tool_result &&
    typeof (entry.tool_result as Record<string, unknown>).content === 'string'
      ? (entry.tool_result as Record<string, unknown>).content as string
      : null;

  const hasDetails = !!(entry.reasoning || entry.tool_result);

  return (
    <div
      className={`log-entry-enter bg-card rounded-lg border-l-2 ${cfg.border} border border-border p-3 cursor-pointer transition-colors hover:bg-surface-elevated`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2.5">
        <span className="bg-surface-elevated text-xs font-mono px-1.5 py-0.5 rounded-md text-muted-foreground tabular-nums shrink-0">
          #{entry.step}
        </span>
        <SpecificIcon size={15} className={`${cfg.color} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-snug break-words">{entry.action}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{time}</span>
            {entry.toolLabel && (
              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                {entry.toolLabel}
              </span>
            )}
          </div>
        </div>
        {hasDetails && (
          <ChevronDown
            size={14}
            className={`text-muted-foreground transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`}
          />
        )}
      </div>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {entry.reasoning && (
            <pre className="text-xs font-mono text-muted-foreground bg-muted p-3 rounded-md whitespace-pre-wrap overflow-x-auto max-h-48 scrollbar-thin">
              {entry.reasoning}
            </pre>
          )}

          {/* File content preview */}
          {fileContent && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Contenu fichier</p>
              <pre className="text-xs font-mono text-foreground bg-muted/60 p-3 rounded-md whitespace-pre-wrap overflow-x-auto max-h-64 scrollbar-thin border border-border">
                {fileContent.length > 3000 ? fileContent.slice(0, 3000) + '\n… (tronqué)' : fileContent}
              </pre>
            </div>
          )}

          {/* Shell output */}
          {entry.type === 'shell' && entry.tool_result && (
            <div>
              {typeof (entry.tool_result as any).stdout === 'string' && (entry.tool_result as any).stdout && (
                <pre className="text-xs font-mono text-green-600 dark:text-green-400 bg-muted/60 p-3 rounded-md whitespace-pre-wrap overflow-x-auto max-h-48 scrollbar-thin border border-border">
                  {(entry.tool_result as any).stdout}
                </pre>
              )}
              {typeof (entry.tool_result as any).stderr === 'string' && (entry.tool_result as any).stderr && (
                <pre className="text-xs font-mono text-red-500 bg-red-50 dark:bg-red-950/20 p-2 rounded-md whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {(entry.tool_result as any).stderr}
                </pre>
              )}
            </div>
          )}

          {/* Raw tool result (non-file, non-shell) */}
          {entry.tool_result && entry.type !== 'file' && entry.type !== 'shell' && !fileContent && (
            <pre className="text-xs font-mono text-secondary bg-muted p-3 rounded-md whitespace-pre-wrap overflow-x-auto max-h-32 scrollbar-thin">
              {JSON.stringify(entry.tool_result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default ActionLogEntry;
