import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Mic, Paperclip, CheckCircle, AlertTriangle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import ChatMessage from './chat/ChatMessage';
import ThinkingIndicator from './chat/ThinkingIndicator';
import TakeoverBanner from './chat/TakeoverBanner';
import ModelSelector from './ModelSelector';
import ProviderConfigModal from './ProviderConfigModal';

const ChatPanel = () => {
  const task = useStore((s) => s.task);
  const setTask = useStore((s) => s.setTask);
  const status = useStore((s) => s.status);
  const entries = useStore((s) => s.entries);
  const startAgent = useStore((s) => s.startAgent);
  const stopAgent = useStore((s) => s.stopAgent);
  const resolveAsk = useStore((s) => s.resolveAsk);
  const currentStep = useStore((s) => s.currentStep);
  const maxSteps = useStore((s) => s.maxSteps);
  const elapsedTime = useStore((s) => s.elapsedTime);
  const [inputValue, setInputValue] = useState('');
  const [configProvider, setConfigProvider] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const chronologicalEntries = [...entries].reverse();

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

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

  // Determine current phase label for thinking indicator
  const lastEntry = entries[0];
  const thinkingLabel = lastEntry?.toolLabel
    ? `${lastEntry.toolLabel}...`
    : isRunning
    ? 'Agent is working...'
    : isPaused
    ? 'Waiting for your input...'
    : 'Processing...';

  return (
    <div className="flex-1 flex flex-col h-screen min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <ModelSelector onConfigureProvider={setConfigProvider} />
          <span className="text-sm font-medium text-foreground">
            {task ? task.slice(0, 60) + (task.length > 60 ? '...' : '') : 'New Task'}
          </span>
          {(isRunning || isPaused) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                Step {currentStep}/{maxSteps}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatTime(elapsedTime)}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPaused && (
            <span className="text-xs text-accent bg-accent/10 px-2.5 py-1 rounded-md font-medium">
              Paused
            </span>
          )}
          {(isRunning || isPaused) && (
            <button
              onClick={stopAgent}
              className="text-xs text-destructive border border-destructive/30 px-3 py-1 rounded-md hover:bg-destructive/10 transition-colors active:scale-[0.97]"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
        {/* User task message */}
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

        {task && entries.length > 0 && (
          <div className="border-t border-border my-2" />
        )}

        {/* Agent entries */}
        {chronologicalEntries.map((entry) => (
          <ChatMessage key={entry.id} entry={entry} onAskReply={resolveAsk} />
        ))}

        {/* Takeover banner */}
        <TakeoverBanner />

        {/* Running indicator */}
        {isRunning && <ThinkingIndicator label={thinkingLabel} />}

        {/* Done message */}
        {status === 'done' && (
          <div className="flex items-center gap-2 py-3 mt-2 log-entry-enter">
            <CheckCircle size={14} className="text-success" />
            <span className="text-sm text-success font-medium">Task completed successfully</span>
          </div>
        )}

        {/* Error message */}
        {status === 'error' && (
          <div className="flex items-center gap-2 py-3 mt-2 text-destructive log-entry-enter">
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
            placeholder="Send a message..."
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
