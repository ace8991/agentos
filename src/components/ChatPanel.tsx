import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Mic, Paperclip, ChevronDown } from 'lucide-react';
import { useStore, type LogEntry, type LogType } from '@/store/useStore';
import { Eye, Brain, MousePointer, CheckCircle, AlertTriangle, Globe, Terminal, Search } from 'lucide-react';

const typeConfig: Record<LogType, { icon: typeof Eye; label: string; color: string }> = {
  perceive: { icon: Eye, label: 'Perceiving', color: 'text-primary' },
  plan: { icon: Brain, label: 'Planning', color: 'text-secondary' },
  act: { icon: MousePointer, label: 'Acting', color: 'text-accent' },
  verify: { icon: CheckCircle, label: 'Verifying', color: 'text-secondary' },
  done: { icon: CheckCircle, label: 'Completed', color: 'text-success' },
  error: { icon: AlertTriangle, label: 'Error', color: 'text-destructive' },
  browser: { icon: Globe, label: 'Browser', color: 'text-secondary' },
  web: { icon: Search, label: 'Web Search', color: 'text-primary' },
  shell: { icon: Terminal, label: 'Shell', color: 'text-accent' },
};

const ChatMessage = ({ entry }: { entry: LogEntry }) => {
  const [expanded, setExpanded] = useState(false);
  const config = typeConfig[entry.type] || typeConfig.act;
  const Icon = config.icon;

  return (
    <div className="flex gap-3 py-3 log-entry-enter">
      <div className="w-7 h-7 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} className={config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
          <span className="text-xs text-muted-foreground">Step {entry.step}</span>
        </div>
        <p className="text-sm text-foreground leading-relaxed break-words">{entry.action}</p>
        {entry.reasoning && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            Reasoning
          </button>
        )}
        {expanded && entry.reasoning && (
          <pre className="mt-2 text-xs font-mono text-muted-foreground bg-muted p-3 rounded-lg whitespace-pre-wrap max-h-40 overflow-y-auto scrollbar-thin">
            {entry.reasoning}
          </pre>
        )}
        {entry.tool_result && (
          <pre className="mt-2 text-xs font-mono text-secondary/80 bg-muted p-3 rounded-lg whitespace-pre-wrap max-h-28 overflow-y-auto scrollbar-thin">
            {JSON.stringify(entry.tool_result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};

const ChatPanel = () => {
  const task = useStore((s) => s.task);
  const setTask = useStore((s) => s.setTask);
  const status = useStore((s) => s.status);
  const entries = useStore((s) => s.entries);
  const startAgent = useStore((s) => s.startAgent);
  const stopAgent = useStore((s) => s.stopAgent);
  const currentStep = useStore((s) => s.currentStep);
  const maxSteps = useStore((s) => s.maxSteps);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const isRunning = status === 'running';

  // Reverse entries for chronological order (store keeps newest first)
  const chronologicalEntries = [...entries].reverse();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;
    setTask(text);
    setInputValue('');
    // Auto-start if idle
    if (status === 'idle') {
      setTimeout(() => {
        useStore.getState().startAgent();
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            {task ? task.slice(0, 60) + (task.length > 60 ? '...' : '') : 'New Task'}
          </span>
          {isRunning && (
            <span className="text-xs text-muted-foreground tabular-nums">
              Step {currentStep}/{maxSteps}
            </span>
          )}
        </div>
        {isRunning && (
          <button
            onClick={stopAgent}
            className="text-xs text-destructive border border-destructive/30 px-3 py-1 rounded-md hover:bg-destructive/10 transition-colors active:scale-[0.97]"
          >
            Stop
          </button>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
        {/* Task message */}
        {task && (
          <div className="flex gap-3 py-3 mb-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-medium text-primary">U</span>
            </div>
            <div className="flex-1">
              <span className="text-xs font-medium text-muted-foreground mb-1 block">You</span>
              <p className="text-sm text-foreground">{task}</p>
            </div>
          </div>
        )}

        {/* Separator */}
        {task && entries.length > 0 && (
          <div className="border-t border-border my-2" />
        )}

        {/* Agent entries as chat messages */}
        {chronologicalEntries.map((entry) => (
          <ChatMessage key={entry.id} entry={entry} />
        ))}

        {/* Running indicator */}
        {isRunning && (
          <div className="flex items-center gap-2 py-3 text-muted-foreground">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                  style={{ animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
            <span className="text-xs">Agent is working...</span>
          </div>
        )}

        {/* Done message */}
        {status === 'done' && (
          <div className="flex items-center gap-2 py-3 mt-2">
            <CheckCircle size={14} className="text-success" />
            <span className="text-sm text-success font-medium">Task completed</span>
          </div>
        )}

        {/* Error message */}
        {status === 'error' && (
          <div className="flex items-center gap-2 py-3 mt-2 text-destructive">
            <AlertTriangle size={14} />
            <span className="text-sm font-medium">
              {useStore.getState().errorMessage || 'An error occurred'}
            </span>
            <button
              onClick={startAgent}
              className="ml-2 text-xs bg-destructive text-destructive-foreground px-3 py-1 rounded-md hover:opacity-90 transition-opacity"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!task && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-surface-elevated flex items-center justify-center mb-4">
              <Send size={20} className="text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">What can I help you with?</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Describe a task and the agent will execute it automatically
            </p>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="px-5 pb-4 pt-2">
        <div className="relative flex items-end bg-muted border border-border rounded-xl px-4 py-3 gap-3 focus-within:glow-purple transition-shadow">
          <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5 mb-0.5">
            <Plus size={18} />
          </button>
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send message to AgentOS"
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none min-h-[20px] max-h-[120px]"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          <div className="flex items-center gap-1 shrink-0 mb-0.5">
            <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <Paperclip size={16} />
            </button>
            <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <Mic size={16} />
            </button>
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() && !isRunning}
              className="ml-1 w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-30 active:scale-95"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
