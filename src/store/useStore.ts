import { create } from 'zustand';
import {
  createExecutionEventStream,
  createExecutionRun,
  getExecutionRun,
  getExecutionSteps,
  getMcpServers,
  getMcpTools,
  stopRun,
  checkHealth,
  syncRuntimeConfig,
  type AgentEvent,
  type ExecutionRunRecord,
  type ExecutionStep,
  type GeneratedWorkspace,
  type HealthResponse,
  type MCPServerConfig,
  type MCPToolRecord,
} from '@/lib/api';
import { isAgentModelSupported, supportsReasoningEffort, type ReasoningEffort } from '@/components/ModelSelector';
import { buildAgentTask, defaultComposerPreferences, type ComposerPreferences } from '@/lib/user-config';
import type { WorkspaceView } from '@/lib/artifacts';
import { getCurrentProjectId as loadCurrentProjectId, setCurrentProjectId as persistCurrentProjectId } from '@/lib/projects';

export type AgentMode = 'smart' | 'chat' | 'agent';
export type AgentStatus = 'idle' | 'running' | 'done' | 'error' | 'paused';
export type LogType = 'perceive' | 'plan' | 'act' | 'verify' | 'done' | 'error' | 'browser' | 'web' | 'shell' | 'info' | 'thinking' | 'ask' | 'result' | 'file';
export type ActiveThread = 'chat' | 'agent' | null;

export interface LogEntry {
  id: string;
  step: number;
  timestamp: string;
  type: LogType;
  action: string;
  reasoning: string;
  screenshot_b64?: string;
  tool_result?: Record<string, unknown>;
  actionType?: string;
  toolLabel?: string;
  attachments?: FileAttachment[];
  askOptions?: string[];
  askResolved?: boolean;
  toolArgs?: Record<string, any>;
}

export interface FileAttachment {
  name: string;
  type: string;
  url?: string;
  content?: string;
}

export interface MemoryItem {
  key: string;
  value: string;
}

export interface Annotation {
  type: 'click' | 'type' | 'scroll';
  x: number;
  y: number;
  text?: string;
}

export interface HistoryRun {
  run_id: string;
  task: string;
  date: string;
  steps: number;
  status: AgentStatus;
  entries: LogEntry[];
  thread?: 'chat' | 'agent';
}

const HISTORY_STORAGE_KEY = 'agentos_history_v2';

const canUseStorage = () => typeof window !== 'undefined';

const createLocalId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `local-${Date.now()}`;

const loadHistoryRuns = (): HistoryRun[] => {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryRun[]) : [];
  } catch {
    return [];
  }
};

const persistHistoryRuns = (history: HistoryRun[]) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Ignore local persistence issues and keep the in-memory state.
  }
};

export type SettingsSection =
  | 'account'
  | 'general'
  | 'documentation'
  | 'mobile-hub'
  | 'api-keys'
  | 'browser-system'
  | 'capture'
  | 'safety'
  | 'scheduled'
  | 'mail'
  | 'data'
  | 'cloud-browser'
  | 'remote-control'
  | 'personalization'
  | 'skills'
  | 'connectors'
  | 'integrations'
  | 'desktop-commander';

interface AppState {
  // Mode
  mode: AgentMode;

  // Agent
  task: string;
  status: AgentStatus;
  currentStep: number;
  maxSteps: number;
  elapsedTime: number;
  model: string;
  captureInterval: number;
  reasoningEffort: ReasoningEffort;
  runId: string | null;
  backendOnline: boolean;
  backendChecked: boolean;
  backendHealth: HealthResponse | null;
  /** Consecutive failed health probes; drives the polling backoff. */
  healthFailureStreak: number;
  errorMessage: string | null;
  activeThread: ActiveThread;
  currentProjectId: string | null;
  incognitoMode: boolean;
  pendingTaskContext: string;

  // Log
  entries: LogEntry[];

  // Memory
  memory: MemoryItem[];

  // Screenshot
  currentScreenshot: string | null;
  browserUrl: string | null;
  browserTitle: string | null;
  lastSurface: 'browser' | 'terminal' | null;
  annotations: Annotation[];

  // History
  history: HistoryRun[];
  viewingHistory: HistoryRun | null;

  // Builder workspace
  activeWorkspace: GeneratedWorkspace | null;
  workspacePanelOpen: boolean;
  workspacePanelView: WorkspaceView;
  activeRun: ExecutionRunRecord | null;
  runSteps: ExecutionStep[];
  selectedToolDetails: ExecutionStep | null;
  mcpServers: MCPServerConfig[];
  capabilityStatus: MCPToolRecord[];

  // Settings
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  historyOpen: boolean;
  composerPreferences: ComposerPreferences;

  // Human takeover
  takeoverRequested: boolean;
  takeoverReason: string | null;

  // Timer
  timerInterval: ReturnType<typeof setInterval> | null;

  // Actions
  setMode: (mode: AgentMode) => void;
  setTask: (task: string) => void;
  setModel: (model: string) => void;
  setMaxSteps: (n: number) => void;
  setCaptureInterval: (ms: number) => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
  setBackendOnline: (online: boolean) => void;
  setBackendHealth: (health: HealthResponse | null) => void;
  syncBackendHealth: () => Promise<void>;
  setActiveThread: (thread: ActiveThread) => void;
  setCurrentProjectId: (projectId: string | null) => void;
  setIncognitoMode: (enabled: boolean) => void;
  setPendingTaskContext: (context: string) => void;
  setSettingsOpen: (open: boolean) => void;
  setSettingsSection: (section: SettingsSection) => void;
  openSettingsFor: (section: SettingsSection) => void;
  setHistoryOpen: (open: boolean) => void;
  setComposerPreferences: (preferences: Partial<ComposerPreferences>) => void;
  resetComposerPreferences: () => void;
  setActiveWorkspace: (workspace: GeneratedWorkspace | null) => void;
  openWorkspacePanel: (view?: WorkspaceView) => void;
  closeWorkspacePanel: () => void;
  setWorkspacePanelView: (view: WorkspaceView) => void;
  setSelectedToolDetails: (step: ExecutionStep | null) => void;
  syncExecutionState: () => Promise<void>;
  syncMcpState: () => Promise<void>;

  startAgent: () => Promise<void>;
  stopAgent: () => Promise<void>;
  pauseAgent: () => void;
  resumeAgent: () => void;
  processEvent: (event: AgentEvent) => void;
  addLogEntry: (entry: LogEntry) => void;
  resolveAsk: (entryId: string, answer: string) => void;
  requestTakeover: (reason: string) => void;
  releaseTakeover: () => void;
  clearMemory: () => void;
  removeMemoryItem: (key: string) => void;
  reset: () => void;
  setViewingHistory: (run: HistoryRun | null) => void;
  deleteHistoryRun: (runId: string) => void;
  saveConversationSnapshot: (options?: { label?: string; thread?: 'chat' | 'agent' }) => void;
  startTimer: () => void;
  stopTimer: () => void;
}

// Map action types to human-readable labels
const toolLabels: Record<string, string> = {
  browser_open: 'Opening a website',
  browser_click: 'Clicking an element',
  browser_type: 'Typing into the page',
  browser_select: 'Selecting an option',
  browser_scroll: 'Scrolling the page',
  browser_wait: 'Waiting for the page',
  browser_snapshot: 'Refreshing live browser view',
  browser_eval: 'Reading page data',
  browser_back: 'Going back',
  browser_close: 'Closing browser session',
  web_search: 'Searching the web',
  web_extract: 'Extracting web content',
  web_qna: 'Answering from web results',
  web_crawl: 'Crawling a website',
  shell: 'Running terminal command',
  click: 'Clicking on screen',
  type: 'Typing on screen',
  scroll: 'Scrolling on screen',
  key: 'Pressing keys',
  wait: 'Waiting',
  computer_use: 'Using desktop controls',
  file_search: 'Searching local files',
  file_read: 'Reading a file',
  file_write: 'Writing a file',
  file_append: 'Updating a file',
  file_delete: 'Deleting a file',
  file_move: 'Moving a file',
  file_copy: 'Copying a file',
  file_exists: 'Checking a file',
  dir_list: 'Listing a folder',
  dir_create: 'Creating a folder',
  dir_delete: 'Removing a folder',
  app_open: 'Launching an app',
  process_list: 'Reading running processes',
  process_kill: 'Stopping a process',
  system_info: 'Checking system information',
  clipboard_get: 'Reading the clipboard',
  clipboard_set: 'Updating the clipboard',
  terminal_open: 'Opening a terminal',
  code_execute: 'Executing code',
  // Desktop Commander
  file_edit: 'Editing a file',
  file_list: 'Listing directory',
  file_create_dir: 'Creating directory',
  file_info: 'Getting file info',
  dc_shell: 'Running terminal command',
};

const buildAgentCompletionMessage = (
  action: string,
  reasoning: string,
  memory: MemoryItem[],
  browserTitle: string | null,
  browserUrl: string | null,
) => {
  const sections: string[] = [];
  const outcome = action.trim() || reasoning.trim() || 'The workflow finished successfully.';

  sections.push(`**Outcome**\n${outcome}`);

  if (browserTitle || browserUrl) {
    sections.push(
      `**Last page checked**\n- ${browserTitle || 'Current page'}${browserUrl ? `\n- ${browserUrl}` : ''}`,
    );
  }

  if (memory.length > 0) {
    const memoryPreview = memory
      .slice(0, 4)
      .map((item) => `- ${item.key}: ${item.value}`)
      .join('\n');
    sections.push(`**Captured context**\n${memoryPreview}`);
  }

  sections.push('**Status**\n- Workflow completed and the important findings are ready above.');

  return sections.join('\n\n');
};

/** Consecutive failed health probes (anti-flicker + polling backoff). */
let healthFailureStreak = 0;

export const useStore = create<AppState>((set, get) => ({

  mode: 'chat',
  task: '',
  status: 'idle',
  currentStep: 0,
  maxSteps: 20,
  elapsedTime: 0,
  model: 'deepseek-chat',
  captureInterval: 1000,
  reasoningEffort: (typeof window !== 'undefined' && (localStorage.getItem('REASONING_EFFORT') as ReasoningEffort | null)) || 'medium',
  runId: null,
  backendOnline: false,
  backendChecked: false,
  backendHealth: null,
  errorMessage: null,
  activeThread: null,
  currentProjectId: loadCurrentProjectId(),
  incognitoMode: typeof window !== 'undefined' && localStorage.getItem('INCOGNITO_MODE') === 'true',
  pendingTaskContext: '',
  entries: [],
  memory: [],
  currentScreenshot: null,
  browserUrl: null,
  browserTitle: null,
  lastSurface: null,
  annotations: [],
  history: loadHistoryRuns(),
  viewingHistory: null,
  activeWorkspace: null,
  workspacePanelOpen: false,
  workspacePanelView: 'preview',
  activeRun: null,
  runSteps: [],
  selectedToolDetails: null,
  mcpServers: [],
  capabilityStatus: [],
  settingsOpen: false,
  settingsSection: 'general',
  historyOpen: false,
  composerPreferences: defaultComposerPreferences,
  takeoverRequested: false,
  takeoverReason: null,
  timerInterval: null,

  setMode: (mode) => set((state) => ({
    mode,
    model: mode === 'agent' && !isAgentModelSupported(state.model) ? 'deepseek-chat' : state.model,
  })),
  setTask: (task) => set({ task }),
  setModel: (model) => set((state) => ({
    model: state.mode === 'agent' && !isAgentModelSupported(model) ? 'deepseek-chat' : model,
  })),
  setMaxSteps: (n) => set({ maxSteps: Math.max(1, Math.min(100, n)) }),
  setCaptureInterval: (ms) => set({ captureInterval: ms }),
  setReasoningEffort: (effort) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('REASONING_EFFORT', effort);
    }
    set({ reasoningEffort: effort });
  },
  setBackendOnline: (online) => set({ backendOnline: online, backendChecked: true }),
  setBackendHealth: (health) => set({ backendHealth: health, backendOnline: !!health, backendChecked: true }),
  syncBackendHealth: async () => {
    try {
      let health = await checkHealth();
      const shouldSyncRuntime = !get().backendOnline || !get().backendChecked;
      if (shouldSyncRuntime) {
        try {
          await syncRuntimeConfig();
          health = await checkHealth();
        } catch {
          // Keep the initial health result if runtime sync is unavailable.
        }
      }
      healthFailureStreak = 0;
      set({ backendHealth: health, backendOnline: true, backendChecked: true });
      void get().syncMcpState();
    } catch {
      healthFailureStreak += 1;
      // Anti-flicker: only declare the backend offline after two consecutive
      // failed probes (a single dropped 2s poll is not an outage).
      if (healthFailureStreak < 2 && get().backendOnline) {
        set({ backendChecked: true });
        return;
      }
      set({
        backendHealth: null,
        backendOnline: false,
        backendChecked: true,
        mcpServers: [],
        capabilityStatus: [],
      });
      // A backend outage must not leave an agent run "running" with half-written steps.
      const state = get();
      if (state.status === 'running') {
        state.stopTimer();
        set({
          status: 'error',
          errorMessage: 'Backend hors ligne : exécution interrompue.',
          runSteps: [],
        });
      }
    }
  },

  setActiveThread: (thread) => set({ activeThread: thread }),
  setCurrentProjectId: (projectId) => {
    persistCurrentProjectId(projectId);
    set({ currentProjectId: projectId });
  },
  setIncognitoMode: (enabled) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('INCOGNITO_MODE', String(enabled));
    }
    set({ incognitoMode: enabled });
  },
  setPendingTaskContext: (context) => set({ pendingTaskContext: context }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setSettingsSection: (section) => set({ settingsSection: section }),
  openSettingsFor: (section) => set({ settingsOpen: true, settingsSection: section }),
  setHistoryOpen: (open) => set({ historyOpen: open }),
  setComposerPreferences: (preferences) =>
    set((state) => ({
      composerPreferences: { ...state.composerPreferences, ...preferences },
    })),
  resetComposerPreferences: () => set({ composerPreferences: defaultComposerPreferences }),
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  openWorkspacePanel: (view) => set((state) => ({ workspacePanelOpen: true, workspacePanelView: view || state.workspacePanelView })),
  closeWorkspacePanel: () => set({ workspacePanelOpen: false }),
  setWorkspacePanelView: (view) => set({ workspacePanelView: view }),
  setSelectedToolDetails: (step) => set({ selectedToolDetails: step }),

  syncExecutionState: async () => {
    const { runId } = get();
    if (!runId) return;
    try {
      const [record, stepsResponse] = await Promise.all([getExecutionRun(runId), getExecutionSteps(runId)]);
      set({
        activeRun: record,
        runSteps: stepsResponse.steps.length > 0 ? stepsResponse.steps : record.plan.steps,
      });
    } catch {
      // Keep the current execution snapshot if the backend is temporarily unavailable.
    }
  },

  syncMcpState: async () => {
    try {
      const [servers, tools] = await Promise.all([getMcpServers(), getMcpTools()]);
      set({
        mcpServers: servers.servers,
        capabilityStatus: tools.tools,
      });
    } catch {
      // Leave the previous MCP snapshot in place if refresh fails.
    }
  },

  startTimer: () => {
    const interval = setInterval(() => {
      set((s) => ({ elapsedTime: s.elapsedTime + 1 }));
    }, 1000);
    set({ timerInterval: interval });
  },

  stopTimer: () => {
    const { timerInterval } = get();
    if (timerInterval) clearInterval(timerInterval);
    set({ timerInterval: null });
  },

  pauseAgent: () => set({ status: 'paused' }),
  resumeAgent: () => set({ status: 'running' }),

  requestTakeover: (reason) => {
    set({ takeoverRequested: true, takeoverReason: reason, status: 'paused' });
  },

  releaseTakeover: () => {
    set({ takeoverRequested: false, takeoverReason: null, status: 'running' });
  },

  resolveAsk: (entryId, answer) => {
    set((s) => ({
      entries: s.entries.map((e) =>
        e.id === entryId ? { ...e, askResolved: true, action: e.action + `\n\n**Your answer:** ${answer}` } : e
      ),
    }));
  },

  startAgent: async () => {
    const { task, model, maxSteps, captureInterval, composerPreferences, reasoningEffort, pendingTaskContext } = get();
    const effectiveTask = buildAgentTask(task, composerPreferences, pendingTaskContext);

    const infoEntry: LogEntry = {
      id: crypto.randomUUID(),
      step: 0,
      timestamp: new Date().toISOString(),
      type: 'info',
      action: `I'll work on this task for you. Let me analyze what needs to be done...`,
      reasoning: '',
    };

    set({
      mode: 'agent',
      status: 'running',
      activeThread: 'agent',
      currentStep: 0,
      elapsedTime: 0,
      entries: [infoEntry],
      memory: [],
      currentScreenshot: null,
      browserUrl: null,
      browserTitle: null,
      lastSurface: null,
      annotations: [],
      errorMessage: null,
      takeoverRequested: false,
      takeoverReason: null,
      activeRun: null,
      runSteps: [],
      selectedToolDetails: null,
    });
    get().startTimer();

    try {
      await syncRuntimeConfig();
      const runRecord = await createExecutionRun({
        task: effectiveTask,
        model,
        max_steps: maxSteps,
        capture_interval_ms: captureInterval,
        reasoning_effort: supportsReasoningEffort(model) ? reasoningEffort : null,
      });
      set({
        runId: runRecord.run_id,
        backendOnline: true,
        activeRun: runRecord,
        runSteps: runRecord.steps.length > 0 ? runRecord.steps : runRecord.plan.steps,
      });

      createExecutionEventStream(
        runRecord.run_id,
        (event) => get().processEvent(event),
        () => {
          // done handled in processEvent
        },
        (msg) => {
          const s = get();
          if (s.status === 'running') {
            set({ status: 'error', errorMessage: msg });
            s.stopTimer();
          }
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start agent';
      const isNetworkFailure = err instanceof TypeError;
      set({
        backendOnline: !isNetworkFailure,
        backendHealth: isNetworkFailure ? null : get().backendHealth,
        status: isNetworkFailure ? 'idle' : 'error',
        entries: isNetworkFailure ? [] : get().entries,
        errorMessage: isNetworkFailure ? null : message,
        activeRun: null,
        runSteps: [],
      });
      get().stopTimer();
    }
  },

  stopAgent: async () => {
    const { runId } = get();
    get().stopTimer();
    set((state) => ({
      status: 'idle',
      activeRun: state.activeRun ? { ...state.activeRun, active: false, status: 'stopped' } : null,
    }));
    if (runId) {
      try {
        await stopRun(runId);
      } catch {
        // Best effort: the run may already be gone server-side.
      }
    }
  },

  processEvent: (event) => {
    const actionType = event.parsed_action?.type || '';
    let logType: LogType = event.type === 'step' ? 'act' : (event.type as LogType);

    if (event.type === 'info') logType = 'info';
    else if (event.type === 'thinking') logType = 'thinking';
    else if (event.type === 'ask') logType = 'ask';
    else if (event.type === 'result') logType = 'result';
    else if (event.type === 'takeover') {
      get().requestTakeover(event.action || 'Human interaction required');
      logType = 'info';
    } else if (event.type === 'step' && actionType) {
      if (actionType.startsWith('browser_')) logType = 'browser';
      else if (actionType.startsWith('web_')) logType = 'web';
      else if (actionType === 'shell') logType = 'shell';
      else if (actionType.startsWith('file_')) logType = 'file';
      else if (actionType === 'dc_shell') logType = 'shell';
    }

    const toolResult =
      event.tool_result && typeof event.tool_result === 'object' && !Array.isArray(event.tool_result)
        ? (event.tool_result as Record<string, unknown>)
        : undefined;

    const entry: LogEntry = {
      id: crypto.randomUUID(),
      step: event.step,
      timestamp: new Date().toISOString(),
      type: logType,
      action: event.action || '',
      reasoning: event.reasoning || '',
      screenshot_b64: event.screenshot_b64,
      tool_result: toolResult,
      actionType,
      toolLabel: toolLabels[actionType] || (actionType ? actionType.replace(/_/g, ' ') : undefined),
      attachments: event.attachments as FileAttachment[],
      askOptions: event.ask_options,
      toolArgs: event.parsed_action as Record<string, any> | undefined,
    };

    const newAnnotations: Annotation[] = [];
    if (event.parsed_action?.type) {
      const pa = event.parsed_action;
      if (['click', 'browser_click'].includes(pa.type) && pa.x != null && pa.y != null) {
        newAnnotations.push({ type: 'click', x: pa.x, y: pa.y, text: pa.text });
      } else if (['type', 'browser_type'].includes(pa.type)) {
        newAnnotations.push({ type: 'type', x: pa.x ?? 0, y: pa.y ?? 0, text: pa.text || pa.selector });
      } else if (['scroll', 'browser_scroll'].includes(pa.type) && pa.x != null && pa.y != null) {
        newAnnotations.push({ type: 'scroll', x: pa.x, y: pa.y });
      }
    }

    let screenshotB64 =
      event.screenshot_b64 ||
      (typeof toolResult?.screenshot_b64 === 'string' ? toolResult.screenshot_b64 : null);
    if (screenshotB64?.startsWith('data:')) {
      screenshotB64 = screenshotB64.replace(/^data:image\/[a-z]+;base64,/, '');
    }

    let memoryItems: MemoryItem[] | undefined;
    if (event.memory) {
      if (Array.isArray(event.memory)) {
        memoryItems = event.memory;
      } else if (typeof event.memory === 'object') {
        memoryItems = Object.entries(event.memory).map(([key, value]) => ({
          key,
          value: String(value),
        }));
      }
    }

    const browserUrl = typeof toolResult?.url === 'string' ? toolResult.url : null;
    const browserTitle = typeof toolResult?.title === 'string' ? toolResult.title : null;
    const nextSurface =
      logType === 'browser' ? 'browser' : logType === 'shell' ? 'terminal' : null;

    set((s) => ({
      entries: [entry, ...s.entries],
      currentStep: event.step,
      currentScreenshot: screenshotB64 || s.currentScreenshot,
      browserUrl: browserUrl || s.browserUrl,
      browserTitle: browserTitle || s.browserTitle,
      lastSurface: nextSurface || s.lastSurface,
      memory: memoryItems || s.memory,
      annotations: newAnnotations.length > 0 ? newAnnotations : s.annotations,
      selectedToolDetails:
        logType === 'act' || logType === 'browser' || logType === 'web' || logType === 'shell' || logType === 'file'
          ? s.runSteps.find((step) => step.step_number === event.step) || s.selectedToolDetails
          : s.selectedToolDetails,
    }));

    if (get().runId) {
      void get().syncExecutionState();
    }

    if (event.type === 'done') {
      get().stopTimer();
      const s = get();
      const completionEntry: LogEntry = {
        id: crypto.randomUUID(),
        step: event.step,
        timestamp: new Date().toISOString(),
        type: 'result',
        action: buildAgentCompletionMessage(
          event.action || 'Done',
          event.reasoning || '',
          memoryItems || s.memory,
          browserTitle || s.browserTitle,
          browserUrl || s.browserUrl,
        ),
        reasoning: event.reasoning || '',
        toolLabel: 'Agent summary',
      };
      const run: HistoryRun = {
        run_id: s.runId || crypto.randomUUID(),
        task: s.task,
        date: new Date().toISOString(),
        steps: s.currentStep,
        status: 'done',
        entries: [completionEntry, ...s.entries],
        thread: 'agent',
      };
      set((prev) => {
        const nextHistory = s.incognitoMode
          ? prev.history
          : [run, ...prev.history.filter((item) => item.run_id !== run.run_id)];
        persistHistoryRuns(nextHistory);
        return {
          status: 'done',
          entries: [completionEntry, ...prev.entries],
          history: nextHistory,
        };
      });
      void get().syncExecutionState();
    }

    if (event.type === 'error') {
      get().stopTimer();
      set({ status: 'error', errorMessage: event.action || 'Unknown error' });
      get().saveConversationSnapshot({ label: get().task, thread: get().activeThread || 'agent' });
      void get().syncExecutionState();
    }
  },

  addLogEntry: (entry) => set((s) => ({ entries: [entry, ...s.entries] })),
  clearMemory: () => set({ memory: [] }),
  removeMemoryItem: (key) => set((s) => ({ memory: s.memory.filter((m) => m.key !== key) })),
  
  reset: () => {
    get().stopTimer();
    set({
      task: '',
      status: 'idle',
      currentStep: 0,
      elapsedTime: 0,
      entries: [],
      memory: [],
      currentScreenshot: null,
      browserUrl: null,
      browserTitle: null,
      lastSurface: null,
      annotations: [],
      errorMessage: null,
      runId: null,
      activeThread: null,
      pendingTaskContext: '',
      takeoverRequested: false,
      takeoverReason: null,
      activeWorkspace: null,
      workspacePanelOpen: false,
      activeRun: null,
      runSteps: [],
      selectedToolDetails: null,
    });
  },
  
  setViewingHistory: (run) =>
    set((state) => ({
      viewingHistory: run,
      entries: run ? run.entries : state.entries,
      task: run?.thread === 'agent' ? run.task : '',
      activeThread: run?.thread || state.activeThread,
      status: run ? (run.status === 'running' ? 'done' : run.status) : state.status,
      currentStep: run?.steps ?? state.currentStep,
      errorMessage: run?.status === 'error' ? state.errorMessage : null,
    })),
  deleteHistoryRun: (runId) =>
    set((state) => {
      const nextHistory = state.history.filter((run) => run.run_id !== runId);
      persistHistoryRuns(nextHistory);
      const nextViewing = state.viewingHistory?.run_id === runId ? null : state.viewingHistory;
      return { history: nextHistory, viewingHistory: nextViewing };
    }),
  saveConversationSnapshot: (options) =>
    set((state) => {
      if (state.incognitoMode || state.entries.length === 0) {
        return {};
      }

      const orderedEntries = [...state.entries].reverse();
      const oldestUserEntry = orderedEntries.find((entry) => entry.type === 'info' && entry.step === 0) || orderedEntries[0];
      const runId = state.runId || `chat-${oldestUserEntry?.id || createLocalId()}`;
      const label =
        options?.label?.trim() ||
        state.task.trim() ||
        oldestUserEntry?.action?.trim() ||
        'Conversation';

      const snapshot: HistoryRun = {
        run_id: runId,
        task: label,
        date: new Date().toISOString(),
        steps: state.currentStep,
        status: state.status === 'idle' ? 'done' : state.status,
        entries: state.entries,
        thread: options?.thread || state.activeThread || 'chat',
      };

      const nextHistory = [snapshot, ...state.history.filter((run) => run.run_id !== runId)];
      persistHistoryRuns(nextHistory);
      return { history: nextHistory };
    }),
}));

