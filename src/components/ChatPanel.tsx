import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle, FolderOpen, Ghost, Layers3, MessageSquareText, Mic, Paperclip, Plus, Send, Square, X } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useStore, type LogEntry } from '@/store/useStore';
import ChatMessage from './chat/ChatMessage';
import LiveSessionCard from './chat/LiveSessionCard';
import ThinkingIndicator from './chat/ThinkingIndicator';
import TakeoverBanner from './chat/TakeoverBanner';
import ModelSelector, { isAgentModelSupported } from './ModelSelector';
import ProviderConfigModal from './ProviderConfigModal';
import ComposerInsertMenu from './chat/ComposerInsertMenu';
import ConnectorQuickAccess from './chat/ConnectorQuickAccess';
import ArtifactWorkspaceModal from './chat/ArtifactWorkspaceModal';
import { chatDirect } from '@/lib/api';
import { collectArtifactsFromEntries } from '@/lib/artifacts';
import {
  CONNECTORS_UPDATED_EVENT,
  loadConnectors,
  mergeConnectorState,
  saveConnectors,
  type ConnectorState,
} from '@/lib/connectors';
import { getBehaviorInstructions, getComposerInstructions, getSavedResponseStyleLabel } from '@/lib/user-config';
import { buildProjectContext, getCurrentProject, loadProjects, PROJECTS_UPDATED_EVENT, type AppProject } from '@/lib/projects';

const ConnectorConfigModal = lazy(() => import('./chat/ConnectorConfigModal'));
const ConnectorsDirectoryModal = lazy(() => import('./chat/ConnectorsDirectoryModal'));
const ProjectsModal = lazy(() => import('./projects/ProjectsModal'));

const shouldRouteToAgent = (
  text: string,
  mode: ReturnType<typeof useStore.getState>['mode'],
  backendOnline: boolean,
) => {
  if (mode !== 'agent' || !backendOnline) return false;
  return text.trim().length > 0;
};

const pickSmartAgentModel = (
  currentModel: string,
  backendHealth: ReturnType<typeof useStore.getState>['backendHealth'],
) => {
  if (isAgentModelSupported(currentModel)) return currentModel;
  if (backendHealth?.system?.anthropic_key) return 'claude-sonnet-4-6';
  if (backendHealth?.system?.openai_key) return 'gpt-4o';
  return 'claude-sonnet-4-6';
};

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
  const activeThread = useStore((s) => s.activeThread);
  const setActiveThread = useStore((s) => s.setActiveThread);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const model = useStore((s) => s.model);
  const setModel = useStore((s) => s.setModel);
  const openSettingsFor = useStore((s) => s.openSettingsFor);
  const composerPreferences = useStore((s) => s.composerPreferences);
  const setComposerPreferences = useStore((s) => s.setComposerPreferences);
  const backendOnline = useStore((s) => s.backendOnline);
  const backendHealth = useStore((s) => s.backendHealth);
  const reasoningEffort = useStore((s) => s.reasoningEffort);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const incognitoMode = useStore((s) => s.incognitoMode);
  const setIncognitoMode = useStore((s) => s.setIncognitoMode);

  const [inputValue, setInputValue] = useState('');
  const [configProvider, setConfigProvider] = useState<string | null>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [configConnectorId, setConfigConnectorId] = useState<string | null>(null);
  const [artifactWorkspaceOpen, setArtifactWorkspaceOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [connectors, setConnectors] = useState<ConnectorState[]>([]);
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const composerMenuButtonRef = useRef<HTMLButtonElement>(null);
  const composerMenuPanelRef = useRef<HTMLDivElement>(null);
  const assistantBufferRef = useRef('');
  const responseStyleLabel = getSavedResponseStyleLabel();

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const chronologicalEntries = [...entries].reverse();
  const artifacts = collectArtifactsFromEntries(entries);
  const currentProject = projects.find((project) => project.id === currentProjectId) || getCurrentProject(projects);

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

  useEffect(() => {
    const syncProjects = () => setProjects(loadProjects());
    syncProjects();
    window.addEventListener(PROJECTS_UPDATED_EVENT, syncProjects);

    return () => {
      window.removeEventListener(PROJECTS_UPDATED_EVENT, syncProjects);
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        composerMenuButtonRef.current &&
        !composerMenuButtonRef.current.contains(target) &&
        !composerMenuPanelRef.current?.contains(target)
      ) {
        setComposerMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setComposerMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;
    setComposerMenuOpen(false);

    if (mode === 'agent' && !backendOnline) {
      toast.error('Agent mode needs the local backend to be online.');
      return;
    }

    if (shouldRouteToAgent(text, mode, backendOnline)) {
      const executionModel = pickSmartAgentModel(model, backendHealth);
      if (executionModel !== model) {
        setModel(executionModel);
        toast.message(`Switched to ${executionModel} for live tool execution.`);
      }

      setTask(text);
      setActiveThread('agent');
      setInputValue('');
      setAttachments([]);

      if (status === 'idle' || status === 'done' || status === 'error') {
        setTimeout(() => {
          useStore.getState().startAgent();
        }, 100);
      }
      return;
    }

    handleChatSend(text);
  };

  const handleChatSend = async (text: string) => {
    if (activeThread === 'agent' && status !== 'running' && status !== 'paused' && entries.length > 0) {
      useStore.getState().reset();
    }

    setInputValue('');
    setAttachments([]);
    setChatLoading(true);
    setActiveThread('chat');

    const userEntry: LogEntry = {
      id: crypto.randomUUID(),
      step: 0,
      timestamp: new Date().toISOString(),
      type: 'info',
      action: text,
      reasoning: '',
    };
    addLogEntry(userEntry);

    const messages: { role: string; content: string }[] = [];
    const behaviorInstructions = [getBehaviorInstructions(), getComposerInstructions(composerPreferences)]
      .filter(Boolean)
      .join('\n\n');
    const projectContext = buildProjectContext(text, currentProject);
    const readyConnectors = connectors.filter((connector) => connector.connected);
    const workspaceContext = [
      `Workspace mode: ${mode}`,
      `Backend: ${backendOnline ? 'online' : 'offline'}`,
      composerPreferences.webResearch ? 'Web research is enabled.' : '',
      readyConnectors.length > 0 ? `Connected tools: ${readyConnectors.map((connector) => connector.name).join(', ')}` : '',
      attachments.length > 0 ? `Attachments: ${attachments.map((file) => file.name).join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const systemContext = [behaviorInstructions, projectContext, workspaceContext].filter(Boolean).join('\n\n');

    if (systemContext) {
      messages.push({ role: 'system', content: systemContext });
    }

    const allEntries = [...useStore.getState().entries].reverse();
    for (const entry of allEntries) {
      if (entry.id === userEntry.id) {
        messages.push({ role: 'user', content: entry.action });
      } else if (entry.type === 'result' || (entry.type === 'info' && entry.step === 0 && messages.length > 0)) {
        messages.push({ role: 'assistant', content: entry.action });
      }
    }

    if (messages.length === 0 || messages[messages.length - 1].content !== text) {
      messages.push({ role: 'user', content: text });
    }

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
      reasoningEffort,
      composerPreferences.webResearch,
      (token) => {
        assistantBufferRef.current += token;
        useStore.setState((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === assistantId ? { ...entry, action: assistantBufferRef.current } : entry,
          ),
        }));
      },
      () => {
        setChatLoading(false);
        useStore.getState().saveConversationSnapshot({ label: text, thread: 'chat' });
      },
      (err) => {
        setChatLoading(false);
        useStore.setState((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === assistantId ? { ...entry, type: 'error', action: err } : entry,
          ),
        }));
        useStore.getState().saveConversationSnapshot({ label: text, thread: 'chat' });
      },
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    setAttachments((previous) => [...previous, ...Array.from(files)]);
    toast.success(`${files.length} file${files.length > 1 ? 's' : ''} attached`);
    event.target.value = '';
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    setAttachments((previous) => [...previous, ...Array.from(files)]);
    toast.success(`${files.length} image${files.length > 1 ? 's' : ''} attached`);
    event.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleToggleComposerPreference = (key: 'webResearch' | 'useStyle') => {
    setComposerPreferences({ [key]: !composerPreferences[key] });
    setComposerMenuOpen(false);
  };

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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col h-screen md:h-screen">
      <div className="flex items-center justify-between border-b border-border px-3 py-3 md:px-5">
        <div className="min-w-0 flex items-center gap-2 md:gap-3">
          <div className="w-10 shrink-0 md:hidden" />
          <ModelSelector onConfigureProvider={setConfigProvider} />
          <span className="hidden truncate text-sm font-medium text-foreground md:inline">
            {task && activeThread === 'agent'
              ? task.slice(0, 50) + (task.length > 50 ? '...' : '')
              : currentProject
              ? `Project: ${currentProject.name}`
              : 'Smart workspace'}
          </span>
          {(isRunning || isPaused) && (
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">
                Step {currentStep}/{maxSteps}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatTime(elapsedTime)}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-full border border-border bg-muted/60 p-1 md:inline-flex">
            <button
              onClick={() => setMode('chat')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                mode !== 'agent'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MessageSquareText size={12} />
              Chat
            </button>
            <button
              onClick={() => setMode('agent')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'agent'
                  ? 'border border-red-500/20 bg-red-500/10 text-red-300'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bot size={12} className={mode === 'agent' ? 'animate-pulse' : undefined} />
              Agent
            </button>
          </div>
          <button
            onClick={() => setProjectsOpen(true)}
            className={`hidden items-center gap-1.5 rounded-md border px-3 py-1 text-xs transition-colors md:inline-flex ${
              currentProject
                ? 'border-sky-300/18 bg-sky-400/10 text-sky-100 hover:bg-sky-400/15'
                : 'border-border text-muted-foreground hover:bg-surface-elevated'
            }`}
          >
            <FolderOpen size={12} />
            {currentProject ? currentProject.name : 'Projects'}
          </button>
          <button
            onClick={() => setIncognitoMode(!incognitoMode)}
            className={`hidden items-center gap-1.5 rounded-md border px-3 py-1 text-xs transition-colors md:inline-flex ${
              incognitoMode
                ? 'border-amber-300/18 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15'
                : 'border-border text-muted-foreground hover:bg-surface-elevated'
            }`}
            title="Private session mode"
          >
            <Ghost size={12} />
            {incognitoMode ? 'Private' : 'Standard'}
          </button>
          {artifacts.length > 0 && (
            <button
              onClick={() => setArtifactWorkspaceOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-elevated active:scale-[0.97]"
            >
              <Layers3 size={12} />
              Artifacts
            </button>
          )}
          {isPaused && (
            <span className="rounded-md bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
              Paused
            </span>
          )}
          {(isRunning || isPaused) && (
            <button
              onClick={stopAgent}
              className="rounded-md border border-destructive/30 px-3 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10 active:scale-[0.97]"
            >
              Stop
            </button>
          )}
          {chatLoading && (
            <button
              onClick={() => setChatLoading(false)}
              className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-elevated active:scale-[0.97]"
            >
              <Square size={11} className="mr-1 inline" />
              Stop
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 md:px-5 md:py-4">
        {activeThread === 'agent' && task && (
          <div className="mb-2 flex gap-3 py-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20">
              <span className="text-xs font-medium text-primary">U</span>
            </div>
            <div className="flex-1">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">You</span>
              <p className="text-sm text-foreground">{task}</p>
            </div>
          </div>
        )}

        {activeThread === 'agent' && task && entries.length > 0 && (
          <div className="my-2 border-t border-border" />
        )}

        {(activeThread === 'agent' || (task && (isRunning || isPaused || status === 'done' || status === 'error'))) && (
          <div className="mx-auto mb-4 w-full max-w-[980px]">
            <LiveSessionCard />
          </div>
        )}

        {chronologicalEntries.map((entry) => {
          if (activeThread !== 'agent' && entry.type === 'info' && entry.step === 0) {
            return (
              <div key={entry.id} className="flex gap-3 py-3">
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

          return <ChatMessage key={entry.id} entry={entry} onAskReply={resolveAsk} />;
        })}

        <TakeoverBanner />

        {(isRunning || chatLoading) && <ThinkingIndicator label={thinkingLabel} />}

        {status === 'done' && activeThread === 'agent' && (
          <div className="log-entry-enter mt-2 flex items-center gap-2 py-3">
            <CheckCircle size={14} className="text-success" />
            <span className="text-sm font-medium text-success">Task completed successfully</span>
          </div>
        )}

        {status === 'error' && (
          <div className="log-entry-enter mt-2 flex items-center gap-2 py-3 text-destructive">
            <AlertTriangle size={14} />
            <span className="text-sm font-medium">
              {useStore.getState().errorMessage || 'An error occurred'}
            </span>
            {activeThread === 'agent' && (
              <button
                onClick={startAgent}
                className="ml-2 rounded-md bg-destructive px-3 py-1 text-xs text-destructive-foreground transition-opacity hover:opacity-90"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {!task && entries.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-elevated">
              <Send size={20} className="text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-base font-medium text-foreground">What can I help you with?</h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              Ask a question directly, or switch to Agent mode when you want live browser, terminal, or desktop execution inside the workspace.
            </p>
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="mx-auto flex w-full max-w-[980px] flex-wrap items-center gap-2 px-3 pt-2 md:px-5">
          {attachments.map((file, index) => (
            <div key={index} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1 text-xs text-foreground">
              <Paperclip size={11} className="text-muted-foreground" />
              {file.type.startsWith('image/') && (
                <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-100">
                  Image
                </span>
              )}
              <span className="max-w-[120px] truncate">{file.name}</span>
              <button onClick={() => removeAttachment(index)} className="text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {(composerPreferences.webResearch || composerPreferences.useStyle) && (
        <div className="mx-auto flex w-full max-w-[980px] flex-wrap items-center gap-2 px-3 pt-2 md:px-5">
          {mode === 'agent' && (
            <button
              onClick={() => setMode('chat')}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-200"
            >
              <Bot size={11} />
              Agent mode
              <X size={11} />
            </button>
          )}
          {composerPreferences.webResearch && (
            <button
              onClick={() => setComposerPreferences({ webResearch: false })}
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/16 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-100"
            >
              Web research
              <X size={11} />
            </button>
          )}
          {composerPreferences.useStyle && (
            <button
              onClick={() => setComposerPreferences({ useStyle: false })}
              className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-300/16 bg-fuchsia-400/10 px-2.5 py-1 text-[11px] font-medium text-fuchsia-100"
            >
              {responseStyleLabel}
              <X size={11} />
            </button>
          )}
        </div>
      )}

      {(currentProject || incognitoMode) && (
        <div className="mx-auto flex w-full max-w-[980px] flex-wrap items-center gap-2 px-3 pt-2 md:px-5">
          {currentProject && (
            <button
              onClick={() => setProjectsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/16 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-100"
            >
              <FolderOpen size={11} />
              {currentProject.name}
            </button>
          )}
          {incognitoMode && (
            <button
              onClick={() => setIncognitoMode(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/16 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-100"
            >
              <Ghost size={11} />
              Private session
              <X size={11} />
            </button>
          )}
          {!composerPreferences.webResearch && !composerPreferences.useStyle && mode === 'agent' && (
            <button
              onClick={() => setMode('chat')}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-200"
            >
              <Bot size={11} />
              Agent mode
              <X size={11} />
            </button>
          )}
        </div>
      )}

      <div className="mx-auto w-full max-w-[980px] px-3 pb-3 pt-2 md:px-5 md:pb-4">
        <div className="relative flex items-end gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 transition-shadow focus-within:glow-purple md:gap-3 md:px-4 md:py-3">
          <button
            ref={composerMenuButtonRef}
            onClick={() => setComposerMenuOpen((open) => !open)}
            className="mb-0.5 shrink-0 p-0.5 text-muted-foreground transition-colors hover:text-foreground active:scale-95"
            title="Insert"
          >
            <Plus size={18} />
          </button>
          <ComposerInsertMenu
            open={composerMenuOpen}
            anchorRef={composerMenuButtonRef}
            panelRef={composerMenuPanelRef}
            connectedCount={connectors.filter((connector) => connector.connected).length}
            responseStyleLabel={responseStyleLabel}
            agentModeEnabled={mode === 'agent'}
            webSearchEnabled={composerPreferences.webResearch}
            useStyleEnabled={composerPreferences.useStyle}
            onToggleAgentMode={() => setMode(mode === 'agent' ? 'chat' : 'agent')}
            onAddFiles={() => {
              setComposerMenuOpen(false);
              fileInputRef.current?.click();
            }}
            onAddImages={() => {
              setComposerMenuOpen(false);
              imageInputRef.current?.click();
            }}
            onOpenGoogleDrive={() => {
              setComposerMenuOpen(false);
              setConfigConnectorId('google-drive');
            }}
            onOpenGitHub={() => {
              setComposerMenuOpen(false);
              setConfigConnectorId('github');
            }}
            onOpenProjects={() => {
              setComposerMenuOpen(false);
              setProjectsOpen(true);
            }}
            onOpenSkills={() => {
              setComposerMenuOpen(false);
              openSettingsFor('skills');
            }}
            onOpenConnectors={() => {
              setComposerMenuOpen(false);
              setDirectoryOpen(true);
            }}
            onToggleWebSearch={() => handleToggleComposerPreference('webResearch')}
            onToggleUseStyle={() => handleToggleComposerPreference('useStyle')}
          />
          <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
          <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
          <textarea
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask something or assign a task..."
            rows={1}
            className="min-h-[20px] max-h-[120px] flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            style={{ height: 'auto' }}
            onInput={(event) => {
              const target = event.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <div className="mb-0.5 flex shrink-0 items-center gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 text-muted-foreground transition-colors hover:text-foreground active:scale-95"
              title="Attach file"
            >
              <Paperclip size={16} />
            </button>
            <button
              onClick={() => toast.message('Voice input UI is ready for the next backend pass.')}
              className="p-1 text-muted-foreground transition-colors hover:text-foreground active:scale-95"
              title="Voice input"
            >
              <Mic size={16} />
            </button>
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || chatLoading || isRunning}
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30 active:scale-95"
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

      <ProviderConfigModal providerId={configProvider} onClose={() => setConfigProvider(null)} />
      <ArtifactWorkspaceModal
        open={artifactWorkspaceOpen}
        artifacts={artifacts}
        onClose={() => setArtifactWorkspaceOpen(false)}
      />
      <Suspense fallback={null}>
        <ProjectsModal open={projectsOpen} onClose={() => setProjectsOpen(false)} />
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
          onSave={(nextState) => {
            setConnectors((previous) => {
              const next = mergeConnectorState(previous, nextState);
              saveConnectors(next);
              return next;
            });
            setConfigConnectorId(null);
          }}
        />
      </Suspense>
    </div>
  );
};

export default ChatPanel;
