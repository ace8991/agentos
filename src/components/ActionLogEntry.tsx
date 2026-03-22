import { useState } from 'react';
import { Eye, Brain, MousePointer, CheckCircle, AlertTriangle, ChevronDown, Globe, Terminal, Search, Info, Loader2, MessageCircleQuestion, FileText } from 'lucide-react';
import type { LogEntry, LogType } from '@/store/useStore';

const typeConfig: Record<LogType, { icon: typeof Eye; color: string; border: string }> = {
  perceive: { icon: Eye, color: 'text-primary', border: 'border-l-primary' },
  plan: { icon: Brain, color: 'text-secondary', border: 'border-l-secondary' },
  act: { icon: MousePointer, color: 'text-accent', border: 'border-l-accent' },
  verify: { icon: CheckCircle, color: 'text-secondary', border: 'border-l-secondary' },
  done: { icon: CheckCircle, color: 'text-success', border: 'border-l-success' },
  error: { icon: AlertTriangle, color: 'text-destructive', border: 'border-l-destructive' },
  browser: { icon: Globe, color: 'text-secondary', border: 'border-l-secondary' },
  web: { icon: Search, color: 'text-primary', border: 'border-l-primary' },
  shell: { icon: Terminal, color: 'text-accent', border: 'border-l-accent' },
  info: { icon: Info, color: 'text-muted-foreground', border: 'border-l-muted-foreground' },
  thinking: { icon: Loader2, color: 'text-primary', border: 'border-l-primary' },
  ask: { icon: MessageCircleQuestion, color: 'text-accent', border: 'border-l-accent' },
  result: { icon: FileText, color: 'text-success', border: 'border-l-success' },
};

const ActionLogEntry = ({ entry }: { entry: LogEntry }) => {
  const [expanded, setExpanded] = useState(false);
  const config = typeConfig[entry.type] || typeConfig.act;
  const Icon = config.icon;
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div
      className={`log-entry-enter bg-card rounded-lg border-l-2 ${config.border} border border-border p-3 cursor-pointer transition-colors hover:bg-surface-elevated`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2.5">
        <span className="bg-surface-elevated text-xs font-mono px-1.5 py-0.5 rounded-md text-muted-foreground tabular-nums shrink-0">
          #{entry.step}
        </span>
        <Icon size={15} className={`${config.color} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground leading-snug break-words">{entry.action}</p>
          <span className="text-xs text-muted-foreground mt-0.5 block">{time}</span>
        </div>
        {(entry.reasoning || entry.tool_result) && (
          <ChevronDown
            size={14}
            className={`text-muted-foreground transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`}
          />
        )}
      </div>

      {expanded && (
        <>
          {entry.reasoning && (
            <pre className="mt-2 text-xs font-mono text-muted-foreground bg-muted p-3 rounded-md whitespace-pre-wrap overflow-x-auto max-h-48 scrollbar-thin">
              {entry.reasoning}
            </pre>
          )}
          {entry.tool_result && (
            <pre className="mt-1.5 text-xs font-mono text-secondary bg-muted p-3 rounded-md whitespace-pre-wrap overflow-x-auto max-h-32 scrollbar-thin">
              {JSON.stringify(entry.tool_result, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
};

export default ActionLogEntry;
