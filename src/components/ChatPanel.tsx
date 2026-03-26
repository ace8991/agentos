import { useState, useRef, useEffect } from 'react';
import { Send, Plus, Mic, Paperclip, CheckCircle, AlertTriangle, Square, X } from 'lucide-react';
import { useStore, type LogEntry } from '@/store/useStore';
import ChatMessage from './chat/ChatMessage';
import ThinkingIndicator from './chat/ThinkingIndicator';
import TakeoverBanner from './chat/TakeoverBanner';
import ModelSelector from './ModelSelector';
import ProviderConfigModal from './ProviderConfigModal';
import ConnectorConfigModal from './chat/ConnectorConfigModal';
import ConnectorsDirectoryModal from './chat/ConnectorsDirectoryModal';
import ConnectorQuickAccess from './chat/ConnectorQuickAccess';
import { chatDirect } from '@/lib/api';
import {
  CONNECTORS_UPDATED_EVENT,
  loadConnectors,
  saveConnectors,
  type ConnectorState,
} from '@/lib/connectors';
import { toast } from '@/components/ui/sonner';

const ChatPanel = () => {
  const task = useStore((s) => s.task);
  const setTask = useStore((s) => s.setTask);
  const status = useStore((s) => s.status);
  const entries = useStore((s) => s.entries);
  const addLogEntry = useStore((s) => s.addLogEntry);
  const startAgent = useStore((s) => s.startAgent);
  const stopAgent = useStore((s) => s.stopAgent);
  const resolveAsk = useStore((s) => s.resolveAsk);
  const currentStep = useStore((s) => s.currentStep);
  const maxSteps = useStore((s) => s.maxSteps);
  const elapsedTime = useStore((s) => s.elapsedTime);
  const mode = useStore((s) => s.mode);
  const model = useStore((s) => s.model);
  const openSettingsFor = useStore((s) => s.openSettingsFor);

  const [inputValue, setInputValue] = useState('');
  const [configProvider, setConfigProvider] = useState<string | null>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [configConnectorId, setConfigConnectorId] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [connectors, setConnectors] = useState<ConnectorState[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assistantBufferRef = useRef('');

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

  useEffect(() => {
    const syncConnectors = () => setConnectors(loadConnectors());
    syncConnectors();
    window.addEventListener(CONNECTORS_UPDATED_EVENT, syncConnectors);

    return () => {
      window.removeEventListener(CONNECTORS_UPDATED_EVENT, syncConnectors);
    };
  }, []);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;

    if (mode === 'chat') {
      handleChatSend(text);
    } else {
      setTask(text);
      setInputValue('');
      setAttachments([]);
      if (status === 'idle') {
        setTimeout(() => {
          useStore.getState().startAgent();
        }, 100);
      }
    }
  };

  const handleChatSend = async (text: string) => {
    setInputValue('');
    setAttachments([]);
    setChatLoading(true);

    // Add user message
    const userEntry: LogEntry = {
      id: crypto.randomUUID(),
      step: 0,
      timestamp: new Date().toISOString(),
      type: 'info',
      action: text,
      reasoning: '',
    };
    addLogEntry(userEntry);

    // Build messages from history
    const messages: { role: string; content: string }[] = [];
    const allEntries = [...useStore.getState().entries].reverse();
    for (const e of allEntries) {
      if (e.id === userEntry.id) {
        messages.push({ role: 'user', content: e.action });
      } else if (e.type === 'result' || (e.type === 'info' && e.step === 0 && messages.length > 0)) {
        messages.push({ role: 'assistant', content: e.action });
      }
    }
    // Ensure the current message is last
    if (messages.length === 0 || messages[messages.length - 1].content !== text) {
      messages.push({ role: 'user', content: text });
    }

    // Create assistant entry that will be updated
    const assistantId = crypto.randomUUID();
    assistantBufferRef.current = '';

    const assistantEntry: LogEntry = {
      id: assistantId,
      step: 0,
      timestamp: new Date().toISOString(),
      type: 'result',
      action: '',
      reasoning: '',
    };
    addLogEntry(assistantEntry);

    await chatDirect(
      messages,
      model,
      (token) => {
        assistantBufferRef.current += token;
        // Update the entry in place
        useStore.setState((s) => ({
          entries: s.entries.map((e) =>
            e.id === assistantId ? { ...e, action: assistantBufferRef.current } : e
          ),
        }));
      },
      () => {
        setChatLoading(false);
      },
      (err) => {
        setChatLoading(false);
        useStore.setState((s) => ({
          entries: s.entries.map((e) =>
            e.id === assistantId ? { ...e, type: 'error', action: err } : e
          ),
        }));
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachments((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Determine current phase label for thinking indicator
  const lastEntry = entries[0];
  const thinkingLabel = lastEntry?.toolLabel
    ? `${lastEntry.toolLabel}...`
    : isRunning
    ? 'Agent is working...'
    : isPaused
    ? 'Waiting for your input...'
    : chatLoading
    ? 'Thinking...'
    : 'Processing...';

  return (
    <div className="flex-1 flex flex-col h-screen md:h-screen min-w-0 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="w-10 md:w-0 shrink-0 md:hidden" />
          <ModelSelector onConfigureProvider={setConfigProvider} />
          <span className="text-sm font-medium text-foreground truncate hidden md:inline">
            {task ? task.slice(0, 50) + (task.length > 50 ? '...' : '') : mode === 'chat' ? 'Chat' : 'New Task'}
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
          {chatLoading && (
            <button
              onClick={() => setChatLoading(false)}
              className="text-xs text-muted-foreground border border-border px-3 py-1 rounded-md hover:bg-surface-elevated transition-colors active:scale-[0.97]"
            >
              <Square size={11} className="inline mr-1" />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-3 md:px-5 py-3 md:py-4">
        {/* User task message (agent mode) */}
        {mode === 'agent' && task && (
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

        {mode === 'agent' && task && entries.length > 0 && (
          <div className="border-t border-border my-2" />
        )}

        {/* Entries */}
        {chronologicalEntries.map((entry) => {
          // In chat mode, render user messages differently
          if (mode === 'chat' && entry.type === 'info' && entry.step === 0) {
            return (
              <div key={entry.id} className="flex gap-3 py-3">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-primary">U</span>
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium text-muted-foreground mb-1 block">You</span>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{entry.action}</p>
                </div>
              </div>
            );
          }
          return <ChatMessage key={entry.id} entry={entry} onAskReply={resolveAsk} />;
        })}

        {/* Takeover banner */}
        <TakeoverBanner />

        {/* Running indicator */}
        {(isRunning || chatLoading) && <ThinkingIndicator label={thinkingLabel} />}

        {/* Done message */}
        {status === 'done' && mode === 'agent' && (
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
            <h3 className="text-base font-medium text-foreground mb-1">
              {mode === 'chat' ? 'Start a conversation' : 'What can I help you with?'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {mode === 'chat'
                ? 'Chat with any AI model — select a provider above'
                : 'Describe a task and the agent will execute it automatically'}
            </p>
          </div>
        )}
      </div>

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="px-5 pt-2 flex items-center gap-2 flex-wrap">
          {attachments.map((file, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-muted border border-border rounded-lg px-2.5 py-1 text-xs text-foreground">
              <Paperclip size={11} className="text-muted-foreground" />
              <span className="truncate max-w-[120px]">{file.name}</span>
              <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="px-3 md:px-5 pb-3 md:pb-4 pt-2">
        <div className="relative flex items-end bg-muted border border-border rounded-xl px-3 md:px-4 py-2.5 md:py-3 gap-2 md:gap-3 focus-within:glow-purple transition-shadow">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5 mb-0.5 active:scale-95"
            title="Add file"
          >
            <Plus size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'chat' ? 'Send a message...' : 'Describe a task...'}
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
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 active:scale-95"
              title="Attach file"
            >
              <Paperclip size={16} />
            </button>
            <button
              onClick={() => toast.message('Voice input UI is ready for the next backend pass.')}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 active:scale-95"
              title="Voice input"
            >
              <Mic size={16} />
            </button>
            <button
              onClick={handleSend}
              disabled={(!inputValue.trim() && !isRunning) || chatLoading}
              className="ml-1 w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-30 active:scale-95"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
        <div className="mt-2">
          <ConnectorQuickAccess
            connectors={connectors}
            onSelect={setConfigConnectorId}
            onOpenDirectory={() => setDirectoryOpen(true)}
            onOpenSettings={() => openSettingsFor('connectors')}
            compact
          />
        </div>
      </div>

      {/* Provider config modal */}
      <ProviderConfigModal providerId={configProvider} onClose={() => setConfigProvider(null)} />
      <ConnectorsDirectoryModal
        open={directoryOpen}
        connectors={connectors}
        onClose={() => setDirectoryOpen(false)}
        onOpenSettings={() => openSettingsFor('connectors')}
        onSelectConnector={(id) => {
          setDirectoryOpen(false);
          setConfigConnectorId(id);
        }}
      />
      <ConnectorConfigModal
        connectorId={configConnectorId}
        onClose={() => setConfigConnectorId(null)}
        onSave={(id, connected) => {
          setConnectors((previous) => {
            const next = previous.map((connector) =>
              connector.id === id ? { ...connector, connected } : connector,
            );
            saveConnectors(next);
            return next;
          });
          setConfigConnectorId(null);
        }}
      />
    </div>
  );
};

export default ChatPanel;
