const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function startRun(params: {
  task: string;
  model: string;
  max_steps: number;
  capture_interval_ms: number;
}): Promise<{ run_id: string }> {
  const r = await fetch(`${BASE}/agent/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!r.ok) throw new Error(`Start failed: ${r.status}`);
  return r.json();
}

export async function stopRun(run_id: string) {
  await fetch(`${BASE}/agent/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run_id }),
  });
}

export function createEventStream(
  run_id: string,
  params: { task: string; model: string; max_steps: number; capture_interval_ms: number },
  onEvent: (e: AgentEvent) => void,
  onDone: () => void,
  onError: (msg: string) => void,
): EventSource {
  const p = new URLSearchParams({
    task: params.task,
    model: params.model,
    max_steps: String(params.max_steps),
    capture_interval_ms: String(params.capture_interval_ms),
  });
  const es = new EventSource(`${BASE}/agent/stream/${run_id}?${p}`);
  es.onmessage = (e) => {
    const data: AgentEvent = JSON.parse(e.data);
    onEvent(data);
    if (data.type === 'done' || data.type === 'error') {
      es.close();
      data.type === 'done' ? onDone() : onError(data.action);
    }
  };
  es.onerror = () => {
    es.close();
    onError('Connection lost');
  };
  return es;
}

export async function checkHealth(): Promise<HealthResponse> {
  const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) });
  return r.json();
}

export async function getModels(): Promise<{ models: ModelInfo[] }> {
  const r = await fetch(`${BASE}/models/all`);
  return r.json();
}

export async function chatStream(
  messages: { role: string; content: string }[],
  model: string,
  webSearch: boolean,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const r = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, web_search: webSearch }),
  });
  if (!r.body) { onError('No response body'); return; }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = JSON.parse(line.slice(6));
      if (data.type === 'token') onToken(data.content);
      else if (data.type === 'done') { onDone(); return; }
      else if (data.type === 'error') { onError(data.content); return; }
    }
  }
  onDone();
}

// Types
export interface AgentEvent {
  type: 'step' | 'done' | 'error' | 'info' | 'thinking' | 'ask' | 'result' | 'takeover';
  step: number;
  action: string;
  reasoning: string;
  screenshot_b64: string;
  memory: { key: string; value: string }[];
  tool_result: unknown;
  parsed_action: { type: string; x?: number; y?: number; text?: string; selector?: string } | null;
  attachments?: { name: string; type: string; url?: string; content?: string }[];
  ask_options?: string[];
}

export interface HealthResponse {
  status: string;
  version: string;
  mode: string;
  available_tools: {
    tavily: boolean;
    playwright: boolean;
    pyautogui: boolean;
    computer_use: boolean;
  };
  system: { os: string; screen?: string };
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  cost_per_step: string;
  vision: boolean;
}
