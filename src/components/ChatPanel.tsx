import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle, Code2, Database, FolderOpen, Ghost, Layers3, MessageSquareText, Mic, MonitorPlay, Paperclip, Plus, Send, Square, X } from 'lucide-react';

import { toast } from '@/components/ui/sonner';
import { useStore, type LogEntry, type AgentMode } from '@/store/useStore';
import ChatMessage from './chat/ChatMessage';
import LiveSessionCard from './chat/LiveSessionCard';
import ThinkingIndicator from './chat/ThinkingIndicator';
import TakeoverBanner from './chat/TakeoverBanner';
import ModelSelector, { isAgentModelSupported } from './ModelSelector';
import ProviderConfigModal from './ProviderConfigModal';
import ComposerInsertMenu from './chat/ComposerInsertMenu';
import ArtifactWorkspaceModal from './chat/ArtifactWorkspaceModal';
import { ArtifactPanel } from './artifact/ArtifactPanel';
import { useArtifactStore } from '@/stores/artifactStore';
import { createArtifactStreamHandler } from '@/hooks/useArtifactStream';
import { chatDirect, createBuilderWorkspace, type ChatMessage as ChatMessageType, type ToolCallEvent, type ToolResultEvent } from '@/lib/api';
import { collectArtifactsFromEntries, type WorkspaceView } from '@/lib/artifacts';
import { executeDesktopCommanderIntent } from '@/lib/desktop-commander-intents';
import {
  CONNECTORS_UPDATED_EVENT,
  loadConnectors,
  mergeConnectorState,
  saveConnectors,
  type ConnectorState,
} from '@/lib/connectors';
import {
  getBehaviorInstructions,
  getComposerInstructions,
  getSavedResponseStyleLabel,
  type ComposerPreferences,
} from '@/lib/user-config';
import { buildProjectContext, getCurrentProject, loadProjects, PROJECTS_UPDATED_EVENT, type AppProject } from '@/lib/projects';
import { buildAttachmentContext } from '@/lib/attachment-context';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import { useIntentEngine } from '@/hooks/useIntentEngine';
import { ResponseTypePill } from '@/components/ResponseTypePill';

const ConnectorConfigModal = lazy(() => import('./chat/ConnectorConfigModal'));
const ConnectorsDirectoryModal = lazy(() => import('./chat/ConnectorsDirectoryModal'));
const ProjectsModal = lazy(() => import('./projects/ProjectsModal'));

const BUILDER_REQUEST_KEYWORDS = [
  'create website',
  'build website',
  'landing page',
  'create app',
  'build app',
  'dashboard',
  'presentation',
  'slides',
  'build a',
  'create a',
  'make a website',
  'make an app',
  'portfolio',
  'saas',
  'game',
  'prototype',
  'site vitrine',
  'creer un site',
  'cree un site',
  'creer une app',
  'cree une app',
  'landing',
  'site web',
  'application web',
];

const shouldUseBuilderWorkspace = (text: string, preferences: ComposerPreferences) => {
  if (preferences.builderMode) return true;
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return BUILDER_REQUEST_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const shouldRouteToAgent = (
  text: string,
  mode: AgentMode,
  backendOnline: boolean,
) => {
  if (!backendOnline) return false;
  return mode === 'agent' && text.trim().length > 0;
};

const requiresLocalTools = (text: string) => {
  const normalized = text.toLowerCase();
  if (!normalized.trim()) return false;
  return [
    'file',
    'fichier',
    'document',
    'dossier',
    'folder',
    'directory',
    'local',
    'pc',
    'ordinateur',
    'desktop',
    'drive',
    'disk',
    'c:\\',
    'c:/',
    'downloads',
    'documents',
    'bureau',
    'passeport',
    'passport',
    'pdf',
    'read',
    'lire',
    'write',
    'ecrire',
    'create file',
    'delete file',
    'rename',
    'move file',
    'copy file',
    'list directory',
  ].some((keyword) => normalized.includes(keyword));
};

const pickSmartAgentModel = (
  currentModel: string,
  backendHealth: ReturnType<typeof useStore.getState>['backendHealth'],
) => {
  if (isAgentModelSupported(currentModel)) return currentModel;
  if (backendHealth?.system?.anthropic_key) return 'claude-sonnet-4-7';
  if (backendHealth?.system?.openai_key) return 'gpt-4o';
  return 'claude-sonnet-4-7';
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
  const pendingTaskContext = useStore((s) => s.pendingTaskContext);
  const setPendingTaskContext = useStore((s) => s.setPendingTaskContext);
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useStore((s) => s.setActiveWorkspace);
  const openWorkspacePanel = useStore((s) => s.openWorkspacePanel);
  const setWorkspacePanelView = useStore((s) => s.setWorkspacePanelView);

  const [inputValue, setInputValue] = useState('');
  const [currentResponseType, setCurrentResponseType] = useState<import('@/lib/intentEngine/types').ResponseType>('text');
  const [configProvider, setConfigProvider] = useState<string | null>(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [configConnectorId, setConfigConnectorId] = useState<string | null>(null);
  const [artifactWorkspaceOpen, setArtifactWorkspaceOpen] = useState(false);
  const [artifactWorkspaceView, setArtifactWorkspaceView] = useState<WorkspaceView>('preview');
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
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
  const appendTranscript = useCallback((transcript: string) => {
    setInputValue((previous) => `${previous.trimEnd()}${previous.trim() ? ' ' : ''}${transcript}`.trim());
  }, []);
  const { supported: speechSupported, listening: speechListening, error: speechError, toggle: toggleSpeechInput } =
    useSpeechInput({
      onTranscript: appendTranscript,
    });

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const chronologicalEntries = [...entries].reverse();
  const artifacts = collectArtifactsFromEntries(entries);
  const workspaceArtifacts = useMemo(
    () => artifacts.filter((artifact) => ['app', 'html', 'webpage', 'code', 'slides', 'markdown', 'document', 'csv', 'pdf'].includes(artifact.type)),
    [artifacts],
  );
  const currentProject = projects.find((project) => project.id === currentProjectId) || getCurrentProject(projects);

  const openArtifactWorkspace = (view: WorkspaceView) => {
    setArtifactWorkspaceView(view);
    setArtifactWorkspaceOpen(true);
  };

  const openGeneratedWorkspace = (view: WorkspaceView) => {
    setWorkspacePanelView(view);
    openWorkspacePanel(view);
  };

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
    if (!task || status !== 'idle' || activeThread || mode === 'agent') {
      return;
    }

    if (shouldUseBuilderWorkspace(task, composerPreferences)) {
      void handleBuilderSend(task, pendingTaskContext);
    } else {
      void handleChatSend(task, pendingTaskContext);
    }
    setTask('');
    setPendingTaskContext('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread, mode, pendingTaskContext, status, task]);

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

  useEffect(() => {
    if (speechError) {
      toast.error(speechError);
    }
  }, [speechError]);

  const { analyzeAndPrepare, lastIntent } = useIntentEngine();

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text) return;
    setComposerMenuOpen(false);

    // Analyse l'intention AVANT d'envoyer
    const intent = analyzeAndPrepare(text, undefined, backendOnline);
    setCurrentResponseType(intent.responseType);

    let attachmentContext = await buildAttachmentContext(attachments);
    const shouldUseBuilder = shouldUseBuilderWorkspace(text, composerPreferences);
    const shouldUseAgent =
      shouldRouteToAgent(text, mode, backendOnline) ||
      (mode === 'agent' && backendOnline && requiresLocalTools(text));

    if (mode === 'agent' && !backendOnline) {
      toast.error('Agent mode needs the local backend to be online.');
      return;
    }

    if (shouldUseBuilder && !backendOnline) {
      toast.error('Builder mode needs the local backend to be online.');
      return;
    }

    if (shouldUseBuilder && backendOnline) {
      await handleBuilderSend(text, attachmentContext);
      return;
    }

    if (mode !== 'agent') {
      const dcResult = await handleDesktopCommanderSend(text);
      if (dcResult === true) {
        // Desktop Commander a géré une action simple (création fichier, dossier, etc.)
        return;
      }
      if (typeof dcResult === 'string') {
        // Desktop Commander a collecté des données système → les injecter comme contexte pour l'IA
        attachmentContext = attachmentContext
          ? `${attachmentContext}\n\n---\nDonnées collectées par Desktop Commander:\n${dcResult}`
          : `Données collectées par Desktop Commander:\n${dcResult}`;
      }
      // Si dcResult === null → pas une intention DC → continuer normalement vers l'IA
    }

    if (shouldUseAgent) {
      // Use the selected model without switching
      if (mode === 'chat') {
        setMode('agent');
        toast.message('Using Agent mode to run local tools for this request.');
      }

      setPendingTaskContext(attachmentContext);
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

    await handleChatSend(text, attachmentContext);
  };

  /**
   * Gère les intentions Desktop Commander.
   * @returns `true` si l'action a été exécutée directement (fichier créé, commande shell)
   *          `string` (contexte) si des données ont été collectées pour analyse par l'IA
   *          `null` si ce n'est pas une intention Desktop Commander
   */
  const handleDesktopCommanderSend = async (text: string): Promise<boolean | string | null> => {
    setChatLoading(true);
    try {
      const execution = await executeDesktopCommanderIntent(text);
      if (!execution) {
        setChatLoading(false);
        return null;
      }

      setComposerMenuOpen(false);
      setInputValue('');
      setAttachments([]);
      setActiveThread('chat');

      addLogEntry({
        id: crypto.randomUUID(),
        step: 0,
        timestamp: new Date().toISOString(),
        type: 'info',
        action: text,
        reasoning: '',
      });

      addLogEntry({
        id: crypto.randomUUID(),
        step: 1,
        timestamp: new Date().toISOString(),
        type: execution.logType,
        action: execution.action,
        reasoning: execution.reasoning,
        tool_result: execution.toolResult,
        actionType: execution.actionType,
        toolLabel: execution.toolLabel,
      });

      // Pour les intentions d'analyse (système, recherche, lecture), on retourne les données
      // comme contexte pour que l'IA les analyse intelligemment
      const analysisIntents = ['system_info', 'file_search', 'file_read'];
      if (analysisIntents.includes(execution.actionType)) {
        addLogEntry({
          id: crypto.randomUUID(),
          step: 1,
          timestamp: new Date().toISOString(),
          type: 'result',
          action: execution.resultMarkdown,
          reasoning: '',
          toolLabel: 'Desktop Commander result',
        });
        useStore.getState().saveConversationSnapshot({ label: text, thread: 'chat' });
        setChatLoading(false);
        return execution.resultMarkdown;
      }

      // Pour les actions simples (fichier créé, dossier, commande shell), on arrête ici
      addLogEntry({
        id: crypto.randomUUID(),
        step: 1,
        timestamp: new Date().toISOString(),
        type: 'result',
        action: execution.resultMarkdown,
        reasoning: '',
        toolLabel: 'Desktop Commander result',
      });
      useStore.getState().saveConversationSnapshot({ label: text, thread: 'chat' });
      setChatLoading(false);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Desktop Commander request failed.';
      addLogEntry({
        id: crypto.randomUUID(),
        step: 1,
        timestamp: new Date().toISOString(),
        type: 'error',
        action: message,
        reasoning: '',
        toolLabel: 'Desktop Commander error',
      });
      useStore.getState().saveConversationSnapshot({ label: text, thread: 'chat' });
      setChatLoading(false);
      return true;
    }
  };

  const handleBuilderSend = async (text: string, attachmentContext = '') => {
    setComposerMenuOpen(false);
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

    const infoEntryId = crypto.randomUUID();
    addLogEntry({
      id: infoEntryId,
      step: 0,
      timestamp: new Date().toISOString(),
      type: 'info',
      action: 'Builder mode engaged. AgentOS is generating a structured local workspace with preview, code, database, and files surfaces.',
      reasoning: '',
      toolLabel: 'Builder',
    });

    try {
      const workspace = await createBuilderWorkspace(
        [text, attachmentContext].filter(Boolean).join('\n\n'),
      );
      setActiveWorkspace(workspace);
      addLogEntry({
        id: crypto.randomUUID(),
        step: 0,
        timestamp: new Date().toISOString(),
        type: 'result',
        action: `${workspace.summary}\n\nWorkspace surfaces:\n- Preview\n- Code\n${workspace.database_files.length > 0 ? '- Database\n' : ''}- Files`,
        reasoning: '',
        toolLabel: 'Workspace ready',
      });
      useStore.getState().saveConversationSnapshot({ label: text, thread: 'chat' });
      toast.success('Builder workspace generated locally.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Builder workspace failed';
      addLogEntry({
        id: crypto.randomUUID(),
        step: 0,
        timestamp: new Date().toISOString(),
        type: 'error',
        action: message,
        reasoning: '',
        toolLabel: 'Builder error',
      });
      toast.error(message);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatSend = async (text: string, attachmentContext = '') => {
    if (activeThread === 'agent' && status !== 'running' && status !== 'paused' && entries.length > 0) {
      useStore.getState().reset();
    }

    setPendingTaskContext('');
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

    const messages: ChatMessageType[] = [];
    const behaviorInstructions = [getBehaviorInstructions(), getComposerInstructions(composerPreferences)]
      .filter(Boolean)
      .join('\n\n');
    const projectContext = buildProjectContext(text, currentProject);
    const readyConnectors = connectors.filter((connector) => connector.connected);
    const workspaceContext = [
      `Workspace mode: ${mode}`,
      `Backend: ${backendOnline ? 'online' : 'offline'}`,
      composerPreferences.builderMode ? 'Agent builder is enabled.' : '',
      composerPreferences.webResearch ? 'Web research is enabled.' : '',
      readyConnectors.length > 0 ? `Connected tools: ${readyConnectors.map((connector) => connector.name).join(', ')}` : '',
      attachments.length > 0 ? `Attachments: ${attachments.map((file) => file.name).join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const systemContext = [behaviorInstructions, projectContext, workspaceContext, attachmentContext]
      .filter(Boolean)
      .join('\n\n');

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
    const streamHandler = createArtifactStreamHandler(assistantId);

    const assistantEntry: LogEntry = {
      id: assistantId,
      step: 0,
      timestamp: new Date().toISOString(),
      type: 'result',
      action: '',
      reasoning: '',
    };
    addLogEntry(assistantEntry);

    // Track tool call entry IDs so we can update them with results
    const toolEntryMap = new Map<string, string>();

    const toolTypeForName = (toolName: string) => {
      if (toolName === 'bash_tool') return 'shell' as const;
      if (toolName === 'web_search') return 'web' as const;
      if (toolName === 'str_replace_editor') return 'file' as const;
      if (toolName === 'list_directory') return 'file' as const;
      if (toolName === 'system_info') return 'perceive' as const;
      return 'act' as const;
    };

    const toolLabelForName = (toolName: string, args: Record<string, unknown>) => {
      if (toolName === 'bash_tool') return `$ ${String(args.command ?? '').slice(0, 60)}`;
      if (toolName === 'str_replace_editor') return `${args.command ?? 'view'} · ${String(args.path ?? '').split('\\').pop()}`;
      if (toolName === 'list_directory') return `ls ${String(args.path ?? '')}`;
      if (toolName === 'web_search') return `🔍 ${String(args.query ?? '')}`;
      if (toolName === 'system_info') return 'system_info';
      return toolName;
    };

    await chatDirect(
      messages,
      model,
      reasoningEffort,
      composerPreferences.webResearch,
      (token) => {
        assistantBufferRef.current += token;
        // Parse les artifacts du stream et récupère le texte nettoyé
        const cleanText = streamHandler.onChunk(token);
        useStore.setState((state) => ({
          entries: state.entries.map((entry) =>
            entry.id === assistantId
              ? { ...entry, action: cleanText || assistantBufferRef.current }
              : entry,
          ),
        }));
      },
      () => {
        setChatLoading(false);
        // Dernier parse pour capturer les artifacts restants
        streamHandler.onDone();
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
      {
        onToolCall: (event: ToolCallEvent) => {
          const entryId = crypto.randomUUID();
          toolEntryMap.set(event.id, entryId);
          const label = toolLabelForName(event.tool, event.args);
          setCurrentTool(event.tool);
          useStore.getState().addLogEntry({
            id: entryId,
            step: 0,
            timestamp: new Date().toISOString(),
            type: toolTypeForName(event.tool),
            action: label,
            reasoning: '',
            toolLabel: label,
            tool_result: undefined,
            actionType: event.tool,
            toolArgs: event.args as Record<string, any>,
          });
        },
        onToolResult: (event: ToolResultEvent) => {
          const entryId = toolEntryMap.get(event.id);
          setCurrentTool(null);
          if (!entryId) return;
          useStore.setState((state) => ({
            entries: state.entries.map((e) =>
              e.id === entryId
                ? {
                    ...e,
                    type: event.success ? toolTypeForName(event.tool) : ('error' as const),
                    tool_result: { output: event.result },
                    reasoning: event.result,
                  }
                : e,
            ),
          }));
        },
      },
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
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

  const handleToggleComposerPreference = (key: keyof Pick<ComposerPreferences, 'webResearch' | 'useStyle' | 'builderMode'>) => {
    setComposerPreferences({ [key]: !composerPreferences[key] });
    setComposerMenuOpen(false);
  };

  const lastEntry = entries[0];
  const toolDisplayName: Record<string, string> = {
    bash_tool: 'Terminal',
    str_replace_editor: 'Editor',
    list_directory: 'Filesystem',
    web_search: 'Web search',
    system_info: 'System',
  };
  const thinkingLabel = currentTool
    ? `${toolDisplayName[currentTool] ?? currentTool}…`
    : lastEntry?.toolLabel
    ? `${lastEntry.toolLabel}...`
    : isRunning
    ? 'Agent is working...'
    : isPaused
    ? 'Waiting for your input...'
    : chatLoading
    ? 'Analysing…'
    : 'Processing...';

  const isArtifactPanelOpen = useArtifactStore((s) => s.isOpen);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 h-screen md:h-screen">
      {/* Chat content — left side (45% quand le panel est ouvert) */}
      <div
        className="flex min-h-0 min-w-0 flex-col"
        style={{
          flex: isArtifactPanelOpen ? '1 1 44%' : '1 1 100%',
          maxWidth: isArtifactPanelOpen ? '44%' : '100%',
          transition: 'flex 0.3s ease, max-width 0.3s ease',
        }}
      >
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
                  ? 'border border-primary/20 bg-primary/10 text-primary-300'
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
                ? 'border-primary-300/18 bg-primary-400/10 text-primary-100 hover:bg-primary-400/15'
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
                ? 'border-primary-300/18 bg-primary-400/10 text-primary-100 hover:bg-primary-400/15'
                : 'border-border text-muted-foreground hover:bg-surface-elevated'
            }`}
            title="Private session mode"
          >
            <Ghost size={12} />
            {incognitoMode ? 'Private' : 'Standard'}
          </button>
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

        {activeWorkspace ? (
          <div className="mx-auto mb-4 w-full max-w-[980px] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-300/14 bg-primary-400/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary-100/78">
                  <Layers3 size={12} />
                  Workspace ready
                </div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-white">{activeWorkspace.title}</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/62">
                  {activeWorkspace.summary}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => openGeneratedWorkspace('preview')}
                  className="inline-flex items-center gap-2 rounded-full border border-primary-300/18 bg-primary-400/10 px-4 py-2 text-sm font-medium text-primary-100 transition-colors hover:bg-primary-400/15"
                >
                  <MonitorPlay size={14} />
                  Preview
                </button>
                <button
                  onClick={() => openGeneratedWorkspace('code')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <Code2 size={14} />
                  Code
                </button>
                {activeWorkspace.database_files.length > 0 && (
                  <button
                    onClick={() => openGeneratedWorkspace('database')}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                  >
                    <Database size={14} />
                    Database
                  </button>
                )}
                <button
                  onClick={() => openGeneratedWorkspace('files')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <FolderOpen size={14} />
                  Files
                </button>
              </div>
            </div>
          </div>
        ) : workspaceArtifacts.length > 0 ? (
          <div className="mx-auto mb-4 w-full max-w-[980px] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-300/14 bg-primary-400/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary-100/78">
                  <Layers3 size={12} />
                  Artifact workspace
                </div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-white">Generated project workspace is ready</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/62">
                  Open the fallback artifact workspace to inspect the live preview, review generated code, or browse artifacts from the conversation.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => openArtifactWorkspace('preview')}
                  className="inline-flex items-center gap-2 rounded-full border border-primary-300/18 bg-primary-400/10 px-4 py-2 text-sm font-medium text-primary-100 transition-colors hover:bg-primary-400/15"
                >
                  <MonitorPlay size={14} />
                  Preview
                </button>
                <button
                  onClick={() => openArtifactWorkspace('code')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <Code2 size={14} />
                  Code
                </button>
                <button
                  onClick={() => openArtifactWorkspace('database')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <Database size={14} />
                  Database
                </button>
                <button
                  onClick={() => openArtifactWorkspace('files')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <FolderOpen size={14} />
                  Files
                </button>
              </div>
            </div>
          </div>
        ) : null}

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

          return (
            <div key={entry.id}>
              <ChatMessage
                entry={entry}
                onAskReply={resolveAsk}
                isStreaming={chatLoading && entry.type === 'result' && entry.id === chronologicalEntries[chronologicalEntries.length - 1]?.id}
              />
            </div>
          );
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
                <span className="rounded-full border border-primary-300/20 bg-primary-400/10 px-1.5 py-0.5 text-[10px] font-medium text-primary-100">
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

      {(composerPreferences.webResearch || composerPreferences.useStyle || composerPreferences.builderMode) && (
        <div className="mx-auto flex w-full max-w-[980px] flex-wrap items-center gap-2 px-3 pt-2 md:px-5">
          {mode === 'agent' && (
            <button
              onClick={() => setMode('chat')}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive"
            >
              <Bot size={11} />
              Agent mode
              <X size={11} />
            </button>
          )}
          {composerPreferences.builderMode && (
            <button
              onClick={() => setComposerPreferences({ builderMode: false })}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-300/16 bg-primary-400/10 px-2.5 py-1 text-[11px] font-medium text-primary-100"
            >
              <Code2 size={11} />
              Agent builder
              <X size={11} />
            </button>
          )}
          {composerPreferences.webResearch && (
            <button
              onClick={() => setComposerPreferences({ webResearch: false })}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-300/16 bg-primary-400/10 px-2.5 py-1 text-[11px] font-medium text-primary-100"
            >
              Web research
              <X size={11} />
            </button>
          )}
          {composerPreferences.useStyle && (
            <button
              onClick={() => setComposerPreferences({ useStyle: false })}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-300/16 bg-primary-400/10 px-2.5 py-1 text-[11px] font-medium text-primary-100"
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
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-300/16 bg-primary-400/10 px-2.5 py-1 text-[11px] font-medium text-primary-100"
            >
              <FolderOpen size={11} />
              {currentProject.name}
            </button>
          )}
          {incognitoMode && (
            <button
              onClick={() => setIncognitoMode(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-300/16 bg-primary-400/10 px-2.5 py-1 text-[11px] font-medium text-primary-100"
            >
              <Ghost size={11} />
              Private session
              <X size={11} />
            </button>
          )}
          {!composerPreferences.webResearch && !composerPreferences.useStyle && !composerPreferences.builderMode && mode === 'agent' && (
            <button
              onClick={() => setMode('chat')}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive"
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
            builderModeEnabled={composerPreferences.builderMode}
            webSearchEnabled={composerPreferences.webResearch}
            useStyleEnabled={composerPreferences.useStyle}
            onToggleAgentMode={() => setMode(mode === 'agent' ? 'chat' : 'agent')}
            onToggleBuilderMode={() => handleToggleComposerPreference('builderMode')}
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
          <div className="flex items-center gap-2 px-1 pb-1">
            <ResponseTypePill
              responseType={currentResponseType}
              isVisible={inputValue.trim().length > 0}
            />
          </div>
          <textarea
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask something or assign a task..."
            rows={1}
            className="min-h-[28px] max-h-[120px] flex-1 resize-none bg-transparent text-base font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
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
              onClick={() => {
                if (!speechSupported) {
                  toast.error('Voice input is not supported in this browser.');
                  return;
                }
                toggleSpeechInput();
              }}
              className={`p-1 transition-colors active:scale-95 ${
                speechListening ? 'text-destructive hover:text-destructive' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Voice input"
            >
              <Mic size={16} className={speechListening ? 'animate-pulse' : undefined} />
            </button>
            <button
              onClick={() => void handleSend()}
              disabled={!inputValue.trim() || chatLoading || isRunning}
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30 active:scale-95"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      </div>

      <ProviderConfigModal providerId={configProvider} onClose={() => setConfigProvider(null)} />
      <ArtifactWorkspaceModal
        open={artifactWorkspaceOpen}
        artifacts={artifacts}
        initialView={artifactWorkspaceView}
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

      {/* Artifact panel — right side (56%) */}
      <ArtifactPanel />
    </div>
  );
};

export default ChatPanel;
