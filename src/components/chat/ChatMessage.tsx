import { useState } from 'react';
import {
  Eye, Brain, MousePointer, CheckCircle, AlertTriangle, Globe, Terminal,
  Search, ChevronDown, Info, Loader2, MessageCircleQuestion, FileText,
  Download, Paperclip
} from 'lucide-react';
import { type LogEntry, type LogType } from '@/store/useStore';
import ArtifactCard, { parseArtifacts } from './ArtifactCard';

const typeConfig: Record<LogType, { icon: typeof Eye; label: string; color: string }> = {
  perceive: { icon: Eye, label: 'Perceiving', color: 'text-primary' },
  plan: { icon: Brain, label: 'Planning', color: 'text-secondary' },
  act: { icon: MousePointer, label: 'Acting', color: 'text-accent' },
  verify: { icon: CheckCircle, label: 'Verifying', color: 'text-secondary' },
  done: { icon: CheckCircle, label: 'Completed', color: 'text-success' },
  error: { icon: AlertTriangle, label: 'Error', color: 'text-destructive' },
  browser: { icon: Globe, label: 'Navigating web', color: 'text-secondary' },
  web: { icon: Search, label: 'Web Search', color: 'text-primary' },
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

const ChatMessage = ({ entry, onAskReply }: ChatMessageProps) => {
  const [expanded, setExpanded] = useState(false);
  const [askInput, setAskInput] = useState('');
  const config = typeConfig[entry.type] || typeConfig.act;
  const Icon = config.icon;

  const isThinking = entry.type === 'thinking';
  const isAsk = entry.type === 'ask';
  const isResult = entry.type === 'result';
  const isInfo = entry.type === 'info';

  // Parse artifacts from result messages
  const { text: displayText, artifacts } = isResult
    ? parseArtifacts(entry.action)
    : { text: entry.action, artifacts: [] };

  // Render markdown-like formatting for result messages
  const renderFormattedText = (text: string) => {
    if (!text.trim()) return null;
    
    // Simple markdown rendering: bold, inline code, links
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono text-foreground">{part.slice(1, -1)}</code>;
      }
      const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{linkMatch[1]}</a>;
      }
      return part;
    });
  };

  return (
    <div className={`flex gap-3 py-3 log-entry-enter ${isResult ? 'bg-success/5 -mx-3 md:-mx-5 px-3 md:px-5 rounded-lg' : ''}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
        isResult ? 'bg-success/15' : isAsk ? 'bg-accent/15' : isInfo ? 'bg-muted' : 'bg-surface-elevated'
      }`}>
        <Icon size={14} className={`${config.color} ${isThinking ? 'animate-spin' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        {/* Header with label and tool description */}
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
          {entry.toolLabel && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{entry.toolLabel}</span>
            </>
          )}
          {entry.step > 0 && (
            <span className="text-xs text-muted-foreground ml-auto tabular-nums">Step {entry.step}</span>
          )}
        </div>

        {/* Main content - with markdown rendering for results */}
        {displayText && (
          <p className="text-sm text-foreground leading-relaxed break-words whitespace-pre-wrap">
            {isResult ? renderFormattedText(displayText) : displayText}
          </p>
        )}

        {/* Artifacts */}
        {artifacts.length > 0 && (
          <div className="space-y-2">
            {artifacts.map((artifact) => (
              <ArtifactCard key={artifact.id} artifact={artifact} />
            ))}
          </div>
        )}

        {/* Attachments */}
        {entry.attachments && entry.attachments.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {entry.attachments.map((file, i) => (
              <a
                key={i}
                href={file.url || '#'}
                download={file.name}
                className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 bg-primary/10 px-3 py-2 rounded-lg w-fit transition-colors"
              >
                <Download size={13} />
                <span>{file.name}</span>
              </a>
            ))}
          </div>
        )}

        {/* Ask options / input */}
        {isAsk && !entry.askResolved && (
          <div className="mt-3 space-y-2">
            {entry.askOptions && entry.askOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {entry.askOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => onAskReply?.(entry.id, opt)}
                    className="text-xs bg-accent/15 text-accent border border-accent/20 px-3 py-1.5 rounded-lg hover:bg-accent/25 transition-colors active:scale-[0.97]"
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
                  placeholder="Type your answer..."
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={() => {
                    if (askInput.trim()) {
                      onAskReply?.(entry.id, askInput.trim());
                      setAskInput('');
                    }
                  }}
                  className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity active:scale-[0.97]"
                >
                  Reply
                </button>
              </div>
            )}
          </div>
        )}

        {/* Reasoning toggle */}
        {entry.reasoning && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown size={12} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            Reasoning
          </button>
        )}
        {expanded && entry.reasoning && (
          <pre className="mt-2 text-xs font-mono text-muted-foreground bg-muted p-3 rounded-lg whitespace-pre-wrap max-h-40 overflow-y-auto scrollbar-thin">
            {entry.reasoning}
          </pre>
        )}

        {/* Tool result */}
        {entry.tool_result && (
          <pre className="mt-2 text-xs font-mono text-secondary/80 bg-muted p-3 rounded-lg whitespace-pre-wrap max-h-28 overflow-y-auto scrollbar-thin">
            {JSON.stringify(entry.tool_result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;