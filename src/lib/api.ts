import { MODEL_PROVIDERS, type ModelProvider } from '@/components/ModelSelector';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const BASE = API_BASE_URL;

// ─── Provider API helpers ────────────────────────────────────────────

function getProviderConfig(modelId: string): { provider: ModelProvider; apiKey: string; baseUrl: string } | null {
  const provider = MODEL_PROVIDERS.find((p) => p.models.some((m) => m.id === modelId));
  if (!provider) return null;

  const apiKey = provider.keyName ? (localStorage.getItem(provider.keyName) || '') : '';
  const baseUrl = provider.baseUrlConfigurable
    ? (localStorage.getItem(`${provider.id.toUpperCase()}_BASE_URL`) || provider.defaultBaseUrl || '')
    : '';

  return { provider, apiKey, baseUrl };
}

function getProviderEndpoint(provider: ModelProvider, baseUrl: string): string {
  switch (provider.id) {
    case 'openai': return 'https://api.openai.com/v1/chat/completions';
    case 'anthropic': return 'https://api.anthropic.com/v1/messages';
    case 'deepseek': return 'https://api.deepseek.com/chat/completions';
    case 'google': return `https://generativelanguage.googleapis.com/v1beta/models/${'{model}'}:streamGenerateContent`;
    case 'mistral': return 'https://api.mistral.ai/v1/chat/completions';
    case 'groq': return 'https://api.groq.com/openai/v1/chat/completions';
    case 'ollama': return `${baseUrl || 'http://localhost:11434'}/api/chat`;
    case 'lmstudio': return `${baseUrl || 'http://localhost:1234'}/v1/chat/completions`;
    default: return '';
  }
}

// ─── Direct LLM Chat (no backend) ──────────────────────────────────

export async function chatDirect(
  messages: { role: string; content: string }[],
  modelId: string,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const config = getProviderConfig(modelId);
  if (!config) { onError(`Unknown model: ${modelId}`); return; }

  const { provider, apiKey, baseUrl } = config;

  if (provider.requiresKey && !apiKey) {
    try {
      await chatStream(messages, modelId, false, onToken, onDone, onError);
      return;
    } catch {
      onError(`No API key configured for ${provider.name}. Go to Settings → API Keys to add your ${provider.keyName}, or configure the backend server keys.`);
      return;
    }
  }

  try {
    if (provider.id === 'anthropic') {
      await streamAnthropic(messages, modelId, apiKey, onToken, onDone, onError);
    } else if (provider.id === 'ollama') {
      await streamOllama(messages, modelId, baseUrl, onToken, onDone, onError);
    } else if (provider.id === 'google') {
      await streamGoogle(messages, modelId, apiKey, onToken, onDone, onError);
    } else {
      // OpenAI-compatible: OpenAI, DeepSeek, Mistral, Groq, LM Studio
      const endpoint = getProviderEndpoint(provider, baseUrl);
      await streamOpenAICompatible(messages, modelId, apiKey, endpoint, onToken, onDone, onError);
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Chat request failed');
  }
}

async function streamOpenAICompatible(
  messages: { role: string; content: string }[],
  model: string,
  apiKey: string,
  endpoint: string,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const r = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!r.ok) {
    const text = await r.text();
    onError(`API error ${r.status}: ${text.slice(0, 200)}`);
    return;
  }

  if (!r.body) { onError('No response body'); return; }
  await parseSSEStream(r.body, onToken, onDone, onError);
}

async function streamAnthropic(
  messages: { role: string; content: string }[],
  model: string,
  apiKey: string,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const systemMsg = messages.find((m) => m.role === 'system');
  const userMessages = messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages: userMessages,
    stream: true,
  };
  if (systemMsg) body.system = systemMsg.content;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const text = await r.text();
    onError(`Anthropic error ${r.status}: ${text.slice(0, 200)}`);
    return;
  }

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
      const json = line.slice(6).trim();
      if (json === '[DONE]') { onDone(); return; }
      try {
        const parsed = JSON.parse(json);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          onToken(parsed.delta.text);
        }
        if (parsed.type === 'message_stop') { onDone(); return; }
      } catch { /* skip */ }
    }
  }
  onDone();
}

async function streamOllama(
  messages: { role: string; content: string }[],
  model: string,
  baseUrl: string,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const actualModel = model.replace('ollama/', '');
  const endpoint = `${baseUrl || 'http://localhost:11434'}/api/chat`;

  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: actualModel, messages, stream: true }),
  });

  if (!r.ok) {
    const text = await r.text();
    onError(`Ollama error ${r.status}: ${text.slice(0, 200)}`);
    return;
  }

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
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) onToken(parsed.message.content);
        if (parsed.done) { onDone(); return; }
      } catch { /* skip */ }
    }
  }
  onDone();
}

async function streamGoogle(
  messages: { role: string; content: string }[],
  model: string,
  apiKey: string,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const systemInstruction = messages.find((m) => m.role === 'system');
  const body: Record<string, unknown> = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction.content }] };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const text = await r.text();
    onError(`Google AI error ${r.status}: ${text.slice(0, 200)}`);
    return;
  }

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
      try {
        const parsed = JSON.parse(line.slice(6));
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) onToken(text);
      } catch { /* skip */ }
    }
  }
  onDone();
}

async function parseSSEStream(
  body: ReadableStream<Uint8Array>,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const reader = body.getReader();
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
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') { onDone(); return; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onToken(content);
      } catch { /* skip partial */ }
    }
  }
  onDone();
}

// ─── Agent backend API (original) ──────────────────────────────────

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
  if (!r.ok) {
    let detail = `Start failed: ${r.status}`;
    try {
      const body = await r.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      try {
        detail = await r.text();
      } catch {
        // Keep the status-based message if the body cannot be parsed.
      }
    }
    throw new Error(detail);
  }
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
  if (!r.ok) throw new Error(`Health check failed: ${r.status}`);
  return r.json();
}

export async function getModels(): Promise<{ models: ModelInfo[] }> {
  const r = await fetch(`${BASE}/models/all`);
  if (!r.ok) throw new Error(`Model fetch failed: ${r.status}`);
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

// ─── Types ─────────────────────────────────────────────────────────

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
