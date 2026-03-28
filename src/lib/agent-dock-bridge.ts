export type AgentDockStatus = 'idle' | 'running' | 'done' | 'error' | 'paused';
export type AgentDockSurface = 'browser' | 'terminal' | null;

export interface AgentDockSnapshot {
  visible: boolean;
  runId: string | null;
  status: AgentDockStatus;
  task: string;
  currentStep: number;
  maxSteps: number;
  elapsedTime: number;
  browserUrl: string | null;
  browserTitle: string | null;
  currentScreenshot: string | null;
  lastSurface: AgentDockSurface;
  latestAction: string | null;
  latestReasoning: string | null;
  latestToolLabel: string | null;
  updatedAt: string;
}

const CHANNEL_NAME = 'agentos-live-dock';
const STORAGE_KEY = 'AGENTOS_LIVE_DOCK_SNAPSHOT';

let liveDockChannel: BroadcastChannel | null = null;

const getChannel = () => {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!liveDockChannel) {
    liveDockChannel = new BroadcastChannel(CHANNEL_NAME);
  }
  return liveDockChannel;
};

export const publishAgentDockSnapshot = (snapshot: AgentDockSnapshot) => {
  if (typeof window === 'undefined') {
    return;
  }

  const payload = JSON.stringify(snapshot);
  window.localStorage.setItem(STORAGE_KEY, payload);
  getChannel()?.postMessage(snapshot);
};

export const readAgentDockSnapshot = (): AgentDockSnapshot | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AgentDockSnapshot) : null;
  } catch {
    return null;
  }
};

export const subscribeAgentDockSnapshot = (callback: (snapshot: AgentDockSnapshot) => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const channel = getChannel();
  const handleMessage = (event: MessageEvent<AgentDockSnapshot>) => {
    if (event.data) {
      callback(event.data);
    }
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) {
      return;
    }
    try {
      callback(JSON.parse(event.newValue) as AgentDockSnapshot);
    } catch {
      // Ignore malformed storage payloads.
    }
  };

  channel?.addEventListener('message', handleMessage);
  window.addEventListener('storage', handleStorage);

  return () => {
    channel?.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
  };
};
