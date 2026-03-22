import { create } from 'zustand';

export type AgentStatus = 'idle' | 'running' | 'done' | 'error' | 'paused';
export type LogType = 'perceive' | 'plan' | 'act' | 'verify' | 'done' | 'error' | 'browser' | 'web' | 'shell' | 'info' | 'thinking' | 'ask' | 'result';

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
  toolLabel?: string;        // Human-readable tool description e.g. "Navigating the web"
  attachments?: FileAttachment[];
  askOptions?: string[];     // For 'ask' type - choices for user
  askResolved?: boolean;     // Whether user has responded
}

export interface FileAttachment {
  name: string;
  type: string;  // mime type
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
}

interface AppState {
  // Agent
  task: string;
  status: AgentStatus;
  currentStep: number;
  maxSteps: number;
  elapsedTime: number;
  model: string;
  captureInterval: number;
  runId: string | null;
  backendOnline: boolean;
  errorMessage: string | null;

  // Log
  entries: LogEntry[];

  // Memory
  memory: MemoryItem[];

  // Screenshot
  currentScreenshot: string | null;
  annotations: Annotation[];

  // History
  history: HistoryRun[];
  viewingHistory: HistoryRun | null;

  // Settings
  settingsOpen: boolean;
  historyOpen: boolean;

  // Human takeover
  takeoverRequested: boolean;
  takeoverReason: string | null;

  // Timer
  timerInterval: ReturnType<typeof setInterval> | null;

  // Actions
  setTask: (task: string) => void;
  setModel: (model: string) => void;
  setMaxSteps: (n: number) => void;
  setCaptureInterval: (ms: number) => void;
  setBackendOnline: (online: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setHistoryOpen: (open: boolean) => void;

  startAgent: () => Promise<void>;
  stopAgent: () => Promise<void>;
  pauseAgent: () => void;
  resumeAgent: () => void;
  processEvent: (event: any) => void;
  addLogEntry: (entry: LogEntry) => void;
  resolveAsk: (entryId: string, answer: string) => void;
  requestTakeover: (reason: string) => void;
  releaseTakeover: () => void;
  clearMemory: () => void;
  removeMemoryItem: (key: string) => void;
  reset: () => void;
  setViewingHistory: (run: HistoryRun | null) => void;
  startTimer: () => void;
  stopTimer: () => void;
}

const API_BASE = 'http://localhost:8000';

// Map action types to human-readable labels
const toolLabels: Record<string, string> = {
  browser_navigate: 'Navigating the web',
  browser_click: 'Clicking an element',
  browser_type: 'Typing text',
  browser_scroll: 'Scrolling page',
  browser_screenshot: 'Capturing screenshot',
  web_search: 'Searching the web',
  web_extract: 'Extracting web content',
  shell: 'Running terminal command',
  file_read: 'Reading a file',
  file_write: 'Writing a file',
  code_execute: 'Executing code',
};

export const useStore = create<AppState>((set, get) => ({
  task: '',
  status: 'idle',
  currentStep: 0,
  maxSteps: 20,
  elapsedTime: 0,
  model: 'claude-sonnet-4-6',
  captureInterval: 1000,
  runId: null,
  backendOnline: true,
  errorMessage: null,
  entries: [],
  memory: [],
  currentScreenshot: null,
  annotations: [],
  history: [],
  viewingHistory: null,
  settingsOpen: false,
  historyOpen: false,
  takeoverRequested: false,
  takeoverReason: null,
  timerInterval: null,

  setTask: (task) => set({ task }),
  setModel: (model) => set({ model }),
  setMaxSteps: (n) => set({ maxSteps: Math.max(1, Math.min(100, n)) }),
  setCaptureInterval: (ms) => set({ captureInterval: ms }),
  setBackendOnline: (online) => set({ backendOnline: online }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setHistoryOpen: (open) => set({ historyOpen: open }),

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

  pauseAgent: () => {
    set({ status: 'paused' });
  },

  resumeAgent: () => {
    set({ status: 'running' });
  },

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
    const { task, model, maxSteps, captureInterval } = get();
    
    // Add initial info message
    const infoEntry: LogEntry = {
      id: crypto.randomUUID(),
      step: 0,
      timestamp: new Date().toISOString(),
      type: 'info',
      action: `I'll work on this task for you. Let me analyze what needs to be done...`,
      reasoning: '',
    };

    set({
      status: 'running',
      currentStep: 0,
      elapsedTime: 0,
      entries: [infoEntry],
      memory: [],
      currentScreenshot: null,
      annotations: [],
      errorMessage: null,
      takeoverRequested: false,
      takeoverReason: null,
    });
    get().startTimer();

    try {
      const res = await fetch(`${API_BASE}/agent/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, model, max_steps: maxSteps, capture_interval_ms: captureInterval }),
      });
      if (!res.ok) throw new Error('Failed to start agent');
      const data = await res.json();
      set({ runId: data.run_id, backendOnline: true });

      const params = new URLSearchParams({
        task,
        model,
        max_steps: String(maxSteps),
        capture_interval_ms: String(captureInterval),
      });
      const evtSource = new EventSource(`${API_BASE}/agent/stream/${data.run_id}?${params}`);
      evtSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          get().processEvent(event);
        } catch {}
      };
      evtSource.onerror = () => {
        evtSource.close();
        const s = get();
        if (s.status === 'running') {
          set({ status: 'error', errorMessage: 'Lost connection to agent stream' });
          s.stopTimer();
        }
      };
    } catch {
      set({ backendOnline: false, status: 'idle', entries: [] });
      get().stopTimer();
    }
  },

  stopAgent: async () => {
    const { runId } = get();
    get().stopTimer();
    set({ status: 'idle' });
    if (runId) {
      try {
        await fetch(`${API_BASE}/agent/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ run_id: runId }),
        });
      } catch {}
    }
  },

  processEvent: (event) => {
    const actionType = event.parsed_action?.type || '';
    let logType: LogType = event.type === 'step' ? 'act' : event.type;
    
    // Map specific event types
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
    }

    const entry: LogEntry = {
      id: crypto.randomUUID(),
      step: event.step,
      timestamp: new Date().toISOString(),
      type: logType,
      action: event.action || '',
      reasoning: event.reasoning || '',
      screenshot_b64: event.screenshot_b64,
      tool_result: event.tool_result,
      actionType,
      toolLabel: toolLabels[actionType] || (actionType ? actionType.replace(/_/g, ' ') : undefined),
      attachments: event.attachments,
      askOptions: event.ask_options,
    };

    const newAnnotations: Annotation[] = [];
    if (event.parsed_action && event.parsed_action.type) {
      const pa = event.parsed_action;
      const clickTypes = ['click', 'browser_click'];
      const typeTypes = ['type', 'browser_type'];
      const scrollTypes = ['scroll', 'browser_scroll'];
      if (clickTypes.includes(pa.type) && pa.x != null && pa.y != null) {
        newAnnotations.push({ type: 'click', x: pa.x, y: pa.y, text: pa.text });
      } else if (typeTypes.includes(pa.type)) {
        newAnnotations.push({ type: 'type', x: pa.x ?? 0, y: pa.y ?? 0, text: pa.text || pa.selector });
      } else if (scrollTypes.includes(pa.type) && pa.x != null && pa.y != null) {
        newAnnotations.push({ type: 'scroll', x: pa.x, y: pa.y });
      }
    }

    let screenshotB64 = event.screenshot_b64 || null;
    if (screenshotB64 && screenshotB64.startsWith('data:')) {
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

    set((s) => ({
      entries: [entry, ...s.entries],
      currentStep: event.step,
      currentScreenshot: screenshotB64 || s.currentScreenshot,
      memory: memoryItems || s.memory,
      annotations: newAnnotations.length > 0 ? newAnnotations : s.annotations,
    }));

    if (event.type === 'done') {
      get().stopTimer();
      const s = get();
      const run: HistoryRun = {
        run_id: s.runId || crypto.randomUUID(),
        task: s.task,
        date: new Date().toISOString(),
        steps: s.currentStep,
        status: 'done',
        entries: s.entries,
      };
      set((prev) => ({ status: 'done', history: [run, ...prev.history] }));
    }

    if (event.type === 'error') {
      get().stopTimer();
      set({ status: 'error', errorMessage: event.action || 'Unknown error' });
    }
  },

  addLogEntry: (entry) => set((s) => ({ entries: [entry, ...s.entries] })),
  clearMemory: () => set({ memory: [] }),
  removeMemoryItem: (key) => set((s) => ({ memory: s.memory.filter((m) => m.key !== key) })),
  reset: () => {
    get().stopTimer();
    set({
      status: 'idle',
      currentStep: 0,
      elapsedTime: 0,
      entries: [],
      memory: [],
      currentScreenshot: null,
      annotations: [],
      errorMessage: null,
      runId: null,
      takeoverRequested: false,
      takeoverReason: null,
    });
  },
  setViewingHistory: (run) => set({ viewingHistory: run }),
}));
