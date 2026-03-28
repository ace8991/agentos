import {
  MODEL_PROVIDERS,
  supportsReasoningEffort,
  type ModelProvider,
  type ReasoningEffort,
} from '@/components/ModelSelector';

const getDefaultApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000';
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8000`;
};

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || getDefaultApiBaseUrl()).replace(/\/$/, '');
const BASE = API_BASE_URL;
const BACKEND_RUNTIME_KEYS = [
  ...new Set(
    [
      ...MODEL_PROVIDERS.filter((provider) => provider.requiresKey && provider.keyName).map((provider) => provider.keyName!),
      'TAVILY_API_KEY',
      'BRAVE_API_KEY',
      'COMPUTER_USE_PROVIDER',
      'COMPUTER_USE_MODEL',
    ],
  ),
] as string[];
const BACKEND_RUNTIME_URL_KEYS = ['OLLAMA_BASE_URL', 'LMSTUDIO_BASE_URL'] as const;

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
  reasoningEffort: ReasoningEffort | null,
  webSearch: boolean,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const config = getProviderConfig(modelId);
  if (!config) { onError(`Unknown model: ${modelId}`); return; }

  const { provider, apiKey, baseUrl } = config;

  if (webSearch) {
    try {
      await syncRuntimeConfig();
      await chatStream(messages, modelId, true, reasoningEffort, onToken, onDone, onError);
      return;
    } catch {
      // Fall back to direct provider chat if the backend is unavailable.
    }
  }

  if (provider.requiresKey && !apiKey) {
    try {
      await chatStream(messages, modelId, webSearch, reasoningEffort, onToken, onDone, onError);
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
      await streamOpenAICompatible(messages, modelId, apiKey, endpoint, reasoningEffort, onToken, onDone, onError);
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
  reasoningEffort: ReasoningEffort | null,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const body: Record<string, unknown> = { model, messages, stream: true };
  if (supportsReasoningEffort(model) && reasoningEffort && reasoningEffort !== 'none') {
    body.reasoning_effort = reasoningEffort;
  }

  const r = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
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
  const systemContent = messages
    .filter((m) => m.role === 'system' && m.content.trim())
    .map((m) => m.content.trim())
    .join('\n\n');
  const userMessages = messages.filter((m) => m.role !== 'system');

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages: userMessages,
    stream: true,
  };
  if (systemContent) body.system = systemContent;

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

  const systemInstruction = messages
    .filter((m) => m.role === 'system' && m.content.trim())
    .map((m) => m.content.trim())
    .join('\n\n');
  const body: Record<string, unknown> = { contents };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
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
  reasoning_effort?: ReasoningEffort | null;
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
  params: { task: string; model: string; max_steps: number; capture_interval_ms: number; reasoning_effort?: ReasoningEffort | null },
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
  if (params.reasoning_effort) {
    p.set('reasoning_effort', params.reasoning_effort);
  }
  const es = new EventSource(`${BASE}/agent/stream/${run_id}?${p}`);
  es.onmessage = (e) => {
    const data: AgentEvent = JSON.parse(e.data);
    onEvent(data);
    if (data.type === 'done' || data.type === 'error') {
      es.close();
      if (data.type === 'done') {
        onDone();
      } else {
        onError(data.action);
      }
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
  reasoningEffort: ReasoningEffort | null,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const r = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, web_search: webSearch, reasoning_effort: reasoningEffort || undefined }),
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

export interface RuntimeConfigResponse {
  applied: Record<string, boolean>;
}

export function buildRuntimeConfigPayload(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }

  const values: Record<string, string> = {};
  for (const key of BACKEND_RUNTIME_KEYS) {
    const value = localStorage.getItem(key)?.trim();
    if (value) {
      values[key] = value;
    }
  }

  for (const key of BACKEND_RUNTIME_URL_KEYS) {
    const value = localStorage.getItem(key)?.trim();
    if (value) {
      values[key] = value;
    }
  }

  return values;
}

export async function syncRuntimeConfig(values = buildRuntimeConfigPayload()): Promise<RuntimeConfigResponse> {
  const r = await fetch(`${BASE}/runtime/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  });
  if (!r.ok) {
    throw new Error(`Runtime config sync failed: ${r.status}`);
  }
  return r.json();
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
  system: {
    os: string;
    screen?: string;
    monitors?: number;
    anthropic_key?: boolean;
    tavily_key?: boolean;
    openai_key?: boolean;
    deepseek_key?: boolean;
    google_key?: boolean;
    screen_error?: string;
    computer_use_provider?: string;
    computer_use_model?: string;
    computer_use_ready?: boolean;
  };
  providers?: {
    anthropic: boolean;
    openai: boolean;
    deepseek: boolean;
    google: boolean;
    tavily: boolean;
  };
  runtime?: {
    supports_browser: boolean;
    supports_terminal: boolean;
    supports_desktop: boolean;
    supports_remote_commands: boolean;
    approval_required: boolean;
    computer_use_provider?: string;
    computer_use_model?: string;
  };
  remote?: RemoteConfig;
  computer_use?: {
    provider?: string;
    model?: string;
    ready?: boolean;
  };
}

export type RemoteCommandStatus = 'pending' | 'approved' | 'claimed' | 'rejected' | 'completed';
export type RemoteChannel = 'telegram' | 'whatsapp' | 'webhook';

export interface RemoteConfig {
  enabled: boolean;
  local_execution_available: boolean;
  approval_required: boolean;
  configured_channels: Record<string, boolean>;
  inbound_path: string;
}

export interface RemoteCommand {
  id: string;
  channel: RemoteChannel;
  text: string;
  sender?: string | null;
  status: RemoteCommandStatus;
  created_at: string;
  updated_at: string;
  actor?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}

export type ConnectorIntegrationMode = 'native' | 'relay' | 'local' | 'manual';
export type ConnectorValidationStatus = 'not_configured' | 'saved' | 'verified' | 'ready_relay' | 'ready_local' | 'error';

export interface ConnectorValidationResponse {
  connector_id: string;
  integration_mode: ConnectorIntegrationMode;
  status: ConnectorValidationStatus;
  ready: boolean;
  message: string;
  checked_at: string;
}

export async function validateConnector(connectorId: string, values: Record<string, string>): Promise<ConnectorValidationResponse> {
  const r = await fetch(`${BASE}/connectors/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connector_id: connectorId, values }),
  });
  if (!r.ok) {
    let detail = `Connector validation failed: ${r.status}`;
    try {
      const body = await r.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      // Keep the status-based message.
    }
    throw new Error(detail);
  }
  return r.json();
}

export async function getRemoteConfig(): Promise<RemoteConfig> {
  const r = await fetch(`${BASE}/remote/config`);
  if (!r.ok) throw new Error(`Remote config failed: ${r.status}`);
  return r.json();
}

export async function getRemoteCommands(status?: RemoteCommandStatus): Promise<RemoteCommand[]> {
  const url = status ? `${BASE}/remote/commands?status=${status}` : `${BASE}/remote/commands`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Remote commands failed: ${r.status}`);
  return r.json();
}

export async function approveRemoteCommand(commandId: string, note?: string) {
  const r = await fetch(`${BASE}/remote/commands/${commandId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor: 'local-user', note }),
  });
  if (!r.ok) throw new Error(`Approve failed: ${r.status}`);
  return r.json() as Promise<RemoteCommand>;
}

export async function rejectRemoteCommand(commandId: string, note?: string) {
  const r = await fetch(`${BASE}/remote/commands/${commandId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor: 'local-user', note }),
  });
  if (!r.ok) throw new Error(`Reject failed: ${r.status}`);
  return r.json() as Promise<RemoteCommand>;
}

export async function claimRemoteCommand(commandId: string) {
  const r = await fetch(`${BASE}/remote/commands/${commandId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor: 'local-workspace' }),
  });
  if (!r.ok) throw new Error(`Claim failed: ${r.status}`);
  return r.json() as Promise<RemoteCommand>;
}

export async function completeRemoteCommand(commandId: string, success: boolean, note?: string) {
  const r = await fetch(`${BASE}/remote/commands/${commandId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor: 'local-workspace', success, note }),
  });
  if (!r.ok) throw new Error(`Complete failed: ${r.status}`);
  return r.json() as Promise<RemoteCommand>;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  cost_per_step: string;
  vision: boolean;
}
