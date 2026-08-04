import { buildChatSystemPrompt } from '@/lib/system-prompt';
import { chatDirectFromBrowser, detectDirectProvider, getApiKey } from '@/lib/browser-providers';

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

const getBase = () => {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  return `${window.location.protocol}//${window.location.hostname}:8000`;
};

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || getBase()).replace(/\/$/, '');
const BASE = API_BASE_URL;

/**
 * Flags the backend as offline immediately (without waiting for the next health
 * poll) so the UI can show the offline status and block partial rendering.
 * Imported dynamically to avoid a circular import with the Zustand store.
 */
export function markBackendOffline(): void {
  try {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__agentos_backend_online__ = false;
    }
    void import('@/store/useStore').then(({ useStore }) => {
      useStore.getState().setBackendOnline(false);
      useStore.setState({ backendHealth: null });
    });
  } catch {
    // best effort
  }
}


export interface ChatMessageContentPart {
  type: 'text' | 'image';
  text?: string;
  source?: { type: 'base64'; media_type: string; data: string };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ChatMessageContentPart[];
  tool_use_id?: string;
}

const MODEL_FIX: Record<string, string> = {
  'gpt-5': 'gpt-4o',
  gpt5: 'gpt-4o',
  'deepseek-r1': 'deepseek-reasoner',
};

const VALID = new Set([
  // Anthropic — latest tier first
  'claude-opus-4-8',
  'claude-sonnet-4-7',
  'claude-opus-4-5',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
  'claude-haiku-4-5',
  'claude-haiku-3-5',
  // OpenAI
  'gpt-5.4',
  'gpt-5.3-codex',
  'gpt-5.2-codex',
  'gpt-5.1',
  'gpt-4o',
  'gpt-4o-mini',
  'o1',
  'o3',
  'o3-mini',
  'o4-mini',
  // DeepSeek
  'deepseek-chat',
  'deepseek-reasoner',
  // Google
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  // Mistral
  'mistral-large-latest',
  'mistral-medium-latest',
  'codestral-latest',
  // Groq
  'llama-3.3-70b-versatile',
  'mixtral-8x7b-32768',
  // Qwen
  'qwen-max',
  'qwen-plus',
  'qwen-turbo',
  'qwen3-235b-a22b-instruct-2507',
  // Ollama (local)
  'ollama/llama3',
  'ollama/mistral',
  'ollama/codellama',
  'ollama/deepseek-r1',
  // LM Studio (local)
  'lmstudio/local-model',
]);

export function normalizeModel(model: string): string {
  if (!model) return 'claude-sonnet-4-7';
  const lowered = model.toLowerCase();
  if (MODEL_FIX[lowered]) return MODEL_FIX[lowered];
  if (VALID.has(lowered)) return lowered;
  if (lowered.includes('deepseek')) return 'deepseek-chat';
  if (lowered.includes('gpt')) return 'gpt-4o';
  if (lowered.includes('gemini')) return 'gemini-2.5-pro';
  if (lowered.includes('mistral') || lowered.includes('codestral')) return 'mistral-large-latest';
  if (lowered.includes('llama') || lowered.includes('mixtral')) return 'llama-3.3-70b-versatile';
  if (lowered.includes('qwen')) return 'qwen-max';
  if (lowered.includes('opus')) return 'claude-opus-4-8';
  if (lowered.includes('haiku')) return 'claude-haiku-4-5';
  return 'claude-sonnet-4-7';
}

async function readError(response: Response, fallback: string) {
  try {
    const payload = await response.json();
    if (payload?.detail) return String(payload.detail);
    if (payload?.error) return String(payload.error);
  } catch {
    // fall through
  }
  try {
    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

export interface ToolCallEvent {
  tool: string;
  args: Record<string, unknown>;
  id: string;
}

export interface ToolResultEvent {
  tool: string;
  result: string;
  id: string;
  success: boolean;
}

export async function chatDirect(
  messages: ChatMessage[],
  model: string,
  reasoningEffort: string | null,
  webResearch: boolean,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  options?: {
    stopSequences?: string[];
    onToolUse?: (toolName: string, args: Record<string, unknown>) => void;
    onThinking?: (text: string) => void;
    onToolCall?: (event: ToolCallEvent) => void;
    onToolResult?: (event: ToolResultEvent) => void;
    images?: Array<{ media_type: string; data: string }>;
    /** Called when the stream is cut mid-flight (backend crash / network loss). */
    onStreamAborted?: (reason: string) => void;
  },
): Promise<void> {

  const normalizedModel = normalizeModel(model);
  try {
    const { resolveModelId } = await import('@/lib/model-guard');
    const mode = messages.some((m) => m.role === 'system' && typeof m.content === 'string' && m.content.includes('agent'))
      ? 'agent' as const
      : 'chat' as const;
    resolveModelId(normalizedModel, mode === 'agent' ? 'agent' : 'chat', { reasoningEffort });
  } catch {
    /* logging is best-effort */
  }
  const userPrompt = [...messages].reverse().find((message) => {
    if (message.role !== 'user') return false;
    return typeof message.content === 'string' ? true : message.content.some(p => p.type === 'text');
  });
  const userText = userPrompt
    ? typeof userPrompt.content === 'string' ? userPrompt.content : userPrompt.content.find(p => p.type === 'text')?.text || ''
    : '';
  const mode = messages.some((message) => message.role === 'system' && typeof message.content === 'string' && message.content.includes('agent'))
    ? 'agent'
    : 'chat';
  const system = buildChatSystemPrompt(userText, normalizedModel, mode, true);
  const payloadMessages = messages.filter((message) => message.role !== 'system');

  // Helper: stream directly from the provider (browser -> Anthropic/OpenAI/etc.)
  // Used when the local backend is unreachable (online/cloud mode).
  const runDirectFromBrowser = async () => {
    await chatDirectFromBrowser(
      { messages: payloadMessages, model: normalizedModel, system, maxTokens: 4096 },
      {
        onToken,
        onThinking: options?.onThinking,
        onDone,
        onError,
      },
    );
  };

  // Fast-path: if we already know the backend is offline (store flag set by
  // RuntimeSync health polling) AND a direct provider key is available, skip
  // the doomed backend round-trip entirely.
  try {
    const backendOffline =
      typeof window !== 'undefined' &&
      (window as any).__agentos_backend_online__ === false;
    if (backendOffline) {
      const provider = detectDirectProvider(normalizedModel);
      if (provider !== 'unsupported' && getApiKey(provider)) {
        await runDirectFromBrowser();
        return;
      }
    }
  } catch {
    // ignore detection errors and fall through to backend attempt
  }

  // Abort controller + inactivity watchdog: if the backend dies mid-stream the
  // socket can hang forever, so we cut it and surface an offline state instead
  // of leaving a half-rendered message on screen.
  const controller = new AbortController();
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let abortedByWatchdog = false;
  const INACTIVITY_MS = 20000;
  const armWatchdog = () => {
    if (watchdog) clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      abortedByWatchdog = true;
      controller.abort();
    }, INACTIVITY_MS);
  };
  const clearWatchdog = () => {
    if (watchdog) {
      clearTimeout(watchdog);
      watchdog = null;
    }
  };

  let streamStarted = false;

  try {
    try {
      await syncRuntimeConfig();
    } catch {
      // Best effort: if sync fails we still attempt the request so existing backend env keys can work.
    }

    armWatchdog();
    const response = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        messages: payloadMessages,
        model: normalizedModel,
        stream: true,
        max_tokens: 4096,
        reasoning_effort: reasoningEffort ?? null,
        web_search: webResearch,
        system,
        ...(options?.stopSequences?.length ? { stop_sequences: options.stopSequences } : {}),
      }),
    });

    if (!response.ok) {
      clearWatchdog();
      onError(await readError(response, `Backend ${response.status}`));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      clearWatchdog();
      onError('No response body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let hasContent = false;

    const failStream = async (reason: string) => {
      clearWatchdog();
      try {
        await reader.cancel();
      } catch {
        // reader may already be closed
      }
      markBackendOffline();
      options?.onStreamAborted?.(reason);
      onError(reason);
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        armWatchdog();
        streamStarted = true;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          if (raw === '[DONE]') {
            clearWatchdog();
            onDone();
            return;
          }
          try {
            const event = JSON.parse(raw);
            if (event.type === 'token' && event.content) {
              hasContent = true;
              onToken(event.content);
            } else if (event.type === 'text' && event.text) {
              hasContent = true;
              onToken(event.text);
            } else if (event.type === 'thinking' && event.text) {
              options?.onThinking?.(event.text);
            } else if (event.type === 'tool_call') {
              // Agentic loop: model is calling a tool
              hasContent = true;
              options?.onToolCall?.({ tool: event.tool, args: event.args ?? {}, id: event.id ?? '' });
              options?.onToolUse?.(event.tool, event.args ?? {});
            } else if (event.type === 'tool_result') {
              // Agentic loop: tool execution result
              options?.onToolResult?.({ tool: event.tool, result: event.result ?? '', id: event.id ?? '', success: event.success ?? true });
            } else if (event.type === 'content_block_delta' && event.delta?.text) {
              hasContent = true;
              onToken(event.delta.text);
            } else if (event.type === 'content_block_delta' && event.delta?.type === 'thinking_delta' && event.delta?.thinking) {
              options?.onThinking?.(event.delta.thinking);
            } else if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
              options?.onToolUse?.(event.content_block.name, event.content_block.input || {});
            } else if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
              // accumulate silently
            } else if (event.type === 'done') {
              clearWatchdog();
              onDone();
              return;
            } else if (event.type === 'error') {
              await failStream(event.content || event.error || 'Streaming error');
              return;
            }
          } catch (parseError) {
            if (parseError instanceof Error && parseError.name === 'AbortError') throw parseError;
            hasContent = true;
            onToken(raw);
          }
        }
      }
    } catch (streamError) {
      const reason = abortedByWatchdog
        ? 'Flux interrompu : aucune donnée du backend pendant 20 s. Backend hors ligne.'
        : 'Flux interrompu : connexion au backend perdue.';
      void streamError;
      await failStream(reason);
      return;
    }

    clearWatchdog();

    if (!hasContent) {
      markBackendOffline();
      onError('No response - check backend connectivity and model configuration.');
    } else {
      onDone();
    }
  } catch (error) {
    clearWatchdog();
    const message = error instanceof Error ? error.message : String(error);
    const looksLikeNetworkFailure =
      message.toLowerCase().includes('fetch') ||
      message.toLowerCase().includes('network') ||
      message.toLowerCase().includes('failed to fetch') ||
      message.toLowerCase().includes('abort');

    if (looksLikeNetworkFailure) {
      markBackendOffline();
      // Mid-stream failures must never be retried: the partial answer is already
      // on screen and a direct retry would duplicate content.
      if (streamStarted) {
        options?.onStreamAborted?.('Flux interrompu : connexion au backend perdue.');
        onError('Flux interrompu : connexion au backend perdue.');
        return;
      }
      // Backend unreachable before any token -> fall back to direct provider call
      const provider = detectDirectProvider(normalizedModel);
      if (provider !== 'unsupported' && getApiKey(provider)) {
        await runDirectFromBrowser();
        return;
      }
      onError(
        `Backend offline and no direct API key found for "${normalizedModel}". Start the local backend on port 8000, or add your provider key in Settings.`,
      );
      return;
    }
    onError(message);
  }
}



export type GeneratedWorkspaceKind = 'website' | 'landing' | 'app' | 'dashboard' | 'slides' | 'presentation';
export type GeneratedWorkspaceFileGroup = 'client' | 'server' | 'database' | 'docs' | 'assets' | 'output';
export type GeneratedWorkspaceStatus = 'building' | 'ready' | 'error';

export interface GeneratedWorkspaceStack {
  frontend: string;
  ui: string;
  backend?: string | null;
  database?: string | null;
}

export interface GeneratedWorkspaceFile {
  path: string;
  name: string;
  group: GeneratedWorkspaceFileGroup;
  language?: string | null;
  size_bytes: number;
}

export interface GeneratedWorkspaceArtifact {
  id: string;
  type: string;
  title: string;
  path: string;
  group: GeneratedWorkspaceFileGroup;
}

export interface GeneratedWorkspace {
  workspace_id: string;
  title: string;
  kind: GeneratedWorkspaceKind;
  stack: GeneratedWorkspaceStack;
  preview_entry: string;
  preview_url: string;
  files: GeneratedWorkspaceFile[];
  database_files: GeneratedWorkspaceFile[];
  artifacts: GeneratedWorkspaceArtifact[];
  status: GeneratedWorkspaceStatus;
  summary: string;
}

export interface WorkspaceFileContent {
  path: string;
  content: string;
  language?: string | null;
}

const encodeWorkspacePath = (filePath: string) =>
  filePath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

export async function createBuilderWorkspace(prompt: string, title?: string): Promise<GeneratedWorkspace> {
  const response = await fetch(`${BASE}/workspace/builder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, title }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Builder workspace failed: ${response.status}`));
  }
  return response.json();
}

export async function getBuilderWorkspace(workspaceId: string): Promise<GeneratedWorkspace> {
  const response = await fetch(`${BASE}/workspace/builder/${workspaceId}`);
  if (!response.ok) {
    throw new Error(await readError(response, `Workspace fetch failed: ${response.status}`));
  }
  return response.json();
}

export async function getBuilderWorkspaceFile(workspaceId: string, filePath: string): Promise<WorkspaceFileContent> {
  const response = await fetch(`${BASE}/workspace/builder/${workspaceId}/file/${encodeWorkspacePath(filePath)}`);
  if (!response.ok) {
    throw new Error(await readError(response, `Workspace file fetch failed: ${response.status}`));
  }
  return response.json();
}

export function getBuilderWorkspaceDownloadUrl(workspaceId: string, filePath: string): string {
  return `${BASE}/workspace/builder/${workspaceId}/download/${encodeWorkspacePath(filePath)}`;
}

// ── Project Generator API ──────────────────────────────────────────────────────

export interface ProjectGenerateRequest {
  prompt: string;
  model?: string;
  title?: string;
}

/** Événement reçu du flux SSE de génération de projet */
export interface ProjectGenerateEvent {
  type: 'phase' | 'text' | 'tool_call' | 'tool_result' | 'file_created' | 'workspace' | 'error';
  phase?: string;
  message?: string;
  text?: string;
  tool?: string;
  args?: Record<string, unknown>;
  id?: string;
  result?: string;
  success?: boolean;
  path?: string;
  total?: number;
  workspace?: GeneratedWorkspace;
  error?: string;
}

/**
 * Génère un projet via SSE streaming.
 * Appelle `onEvent` pour chaque événement reçu.
 * Retourne le GeneratedWorkspace final.
 */
export async function generateProject(
  params: ProjectGenerateRequest,
  onEvent?: (event: ProjectGenerateEvent) => void,
  signal?: AbortSignal,
): Promise<GeneratedWorkspace> {
  const response = await fetch(`${BASE}/project/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Project generation failed: ${response.status}`));
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const event: ProjectGenerateEvent = JSON.parse(trimmed.slice(6));
        onEvent?.(event);
        if (event.type === 'workspace' && event.workspace) {
          return event.workspace;
        }
        if (event.type === 'error') {
          throw new Error(event.error ?? 'Erreur inconnue');
        }
      } catch (err) {
        if (err instanceof SyntaxError) continue;
        throw err;
      }
    }
  }

  throw new Error('Stream ended without workspace');
}

export async function getProjectStatus(workspaceId: string): Promise<{ status: string; workspace?: GeneratedWorkspace }> {
  const response = await fetch(`${BASE}/project/generate/${workspaceId}/status`);
  if (!response.ok) {
    throw new Error(await readError(response, `Project status fetch failed: ${response.status}`));
  }
  return response.json();
}

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
    desktop_commander?: boolean;
  };
  system: {
    os: string;
    anthropic_key?: boolean;
    openai_key?: boolean;
    deepseek_key?: boolean;
    tavily_key?: boolean;
    computer_use_provider?: string;
    computer_use_model?: string;
    computer_use_ready?: boolean;
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
  mobile_hub?: {
    gateway_status?: string;
    connected_devices?: number;
    configured_channels?: number;
    voice_overlay?: boolean;
    mobile_hud?: boolean;
  };
  desktop_commander?: {
    enabled?: boolean;
  };
  project_generator?: {
    ready: boolean;
    providers: string[];
    reason?: string | null;
  };
  providers?: Record<string, boolean>;
}

export function isProjectGeneratorReady(health: HealthResponse | null | undefined): {
  ready: boolean;
  reason?: string;
} {
  if (!health) return { ready: false, reason: 'Backend hors ligne' };
  const pg = health.project_generator;
  if (pg) {
    return pg.ready
      ? { ready: true }
      : { ready: false, reason: pg.reason ?? 'Aucun provider LLM configuré' };
  }
  // Fallback for older backend payloads
  const hasProvider = health.system?.anthropic_key || health.system?.openai_key || health.system?.deepseek_key;
  return hasProvider
    ? { ready: true }
    : { ready: false, reason: 'Aucun provider LLM configuré' };
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json();
}

export async function checkBackendHealth(): Promise<{ online: boolean; version?: string }> {
  try {
    const health = await checkHealth();
    return { online: true, version: health.version };
  } catch {
    return { online: false };
  }
}

export interface RuntimeConfigResponse {
  applied: Record<string, boolean>;
}

export function buildRuntimeConfigPayload(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const keys = [
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'DEEPSEEK_API_KEY',
    'GOOGLE_API_KEY',
    'MISTRAL_API_KEY',
    'GROQ_API_KEY',
    'QWEN_API_KEY',
    'TAVILY_API_KEY',
    'BRAVE_API_KEY',
    'OLLAMA_BASE_URL',
    'LMSTUDIO_BASE_URL',
    'COMPUTER_USE_PROVIDER',
    'COMPUTER_USE_MODEL',
    'PLAYWRIGHT_HEADFUL',
    'PLAYWRIGHT_EXTERNAL_BROWSER',
    'PLAYWRIGHT_BROWSER',
    'PLAYWRIGHT_VIEWPORT_WIDTH',
    'PLAYWRIGHT_VIEWPORT_HEIGHT',
    'PLAYWRIGHT_SLOWMO',
    'BROWSER_RECORD_VIDEO',
    'BROWSER_SAVE_SCREENSHOTS',
    'BROWSER_SCREENSHOT_DIR',
    'BROWSER_VIDEO_DIR',
    'BROWSER_EFFICIENCY_MODE',
    'BROWSER_USE_ELEMENT_CACHE',
    'BROWSER_TARGETED_SCREENSHOTS',
  ];

  return keys.reduce<Record<string, string>>((accumulator, key) => {
    const value = localStorage.getItem(key)?.trim();
    if (value) accumulator[key] = value;
    return accumulator;
  }, {});
}

export async function syncRuntimeConfig(values = buildRuntimeConfigPayload()): Promise<RuntimeConfigResponse> {
  const response = await fetch(`${BASE}/runtime/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Runtime config sync failed: ${response.status}`));
  }
  return response.json();
}

export async function downloadWorkspaceArchive(): Promise<void> {
  const response = await fetch(`${BASE}/workspace/download`);
  if (!response.ok) {
    throw new Error(await readError(response, `Workspace download failed: ${response.status}`));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'agentos-local-workspace.zip';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export type ToolProviderKind = 'internal' | 'mcp';
export type MCPTransport = 'internal' | 'stdio';
export type MCPServerStatus = 'ready' | 'configured' | 'disabled' | 'error';
export type ExecutionIntentKind = 'chat' | 'filesystem' | 'terminal' | 'desktop' | 'browser' | 'web' | 'builder' | 'code' | 'hybrid';
export type ExecutionStatus = 'planning' | 'running' | 'completed' | 'error' | 'stopped';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type SubagentRole =
  | 'planner'
  | 'files'
  | 'terminal'
  | 'desktop'
  | 'browser'
  | 'code-analyzer'
  | 'code-editor'
  | 'test-runner'
  | 'reviewer'
  | 'documentation';

export interface ToolInvocation {
  family: string;
  provider_id: string;
  provider_kind: ToolProviderKind;
  tool_name: string;
  arguments: Record<string, unknown>;
  status: StepStatus;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface CheckpointMetadata {
  id: string;
  kind: 'logical' | 'files';
  summary: string;
  created_at: string;
  files: string[];
  storage_path?: string | null;
}

export interface ExecutionStep {
  id: string;
  step_number: number;
  title: string;
  description: string;
  status: StepStatus;
  subagent_role?: SubagentRole | null;
  tool_invocation?: ToolInvocation | null;
  checkpoint?: CheckpointMetadata | null;
  result_summary?: string | null;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface ExecutionIntent {
  kind: ExecutionIntentKind;
  summary: string;
  requires_live_browser: boolean;
  requires_filesystem: boolean;
  requires_terminal: boolean;
  requires_desktop: boolean;
  requires_builder: boolean;
  requires_code: boolean;
  requires_web_search: boolean;
  preferred_capabilities: string[];
}

export interface SubagentTask {
  id: string;
  role: SubagentRole;
  title: string;
  description: string;
  status: StepStatus;
  depends_on: string[];
  allowed_families: string[];
  result_summary?: string | null;
  error?: string | null;
}

export interface ExecutionPlan {
  id: string;
  task: string;
  model: string;
  intent: ExecutionIntent;
  summary: string;
  subagents: SubagentTask[];
  steps: ExecutionStep[];
  preferred_providers: string[];
  created_at: string;
}

export interface ExecutionSummary {
  outcome: string;
  validated: boolean;
  next_step?: string | null;
}

export interface ExecutionRunRecord {
  run_id: string;
  task: string;
  model: string;
  status: ExecutionStatus;
  max_steps: number;
  capture_interval_ms: number;
  reasoning_effort?: ReasoningEffort | null;
  active: boolean;
  current_step: number;
  plan: ExecutionPlan;
  steps: ExecutionStep[];
  summary?: ExecutionSummary | null;
  workspace_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExecutionStepsResponse {
  run_id: string;
  steps: ExecutionStep[];
}

export interface ExecutionPlanRequest {
  task: string;
  model: string;
  max_steps?: number;
}

export interface ExecutionRunRequest {
  task: string;
  model: string;
  max_steps: number;
  capture_interval_ms: number;
  reasoning_effort?: ReasoningEffort | null;
}

export async function createExecutionPlan(params: ExecutionPlanRequest): Promise<ExecutionPlan> {
  const response = await fetch(`${BASE}/execute/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Execution plan failed: ${response.status}`));
  }
  return response.json();
}

export async function createExecutionRun(params: ExecutionRunRequest): Promise<ExecutionRunRecord> {
  const response = await fetch(`${BASE}/execute/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Execution start failed: ${response.status}`));
  }
  return response.json();
}

export async function getExecutionRun(runId: string): Promise<ExecutionRunRecord> {
  const response = await fetch(`${BASE}/execute/runs/${runId}`);
  if (!response.ok) {
    throw new Error(await readError(response, `Execution run fetch failed: ${response.status}`));
  }
  return response.json();
}

export async function getExecutionSteps(runId: string): Promise<ExecutionStepsResponse> {
  const response = await fetch(`${BASE}/execute/runs/${runId}/steps`);
  if (!response.ok) {
    throw new Error(await readError(response, `Execution steps fetch failed: ${response.status}`));
  }
  return response.json();
}

export function createExecutionEventStream(
  runId: string,
  onEvent: (event: AgentEvent) => void,
  onDone: () => void,
  onError: (message: string) => void,
): EventSource {
  let source: EventSource | null = null;
  let settled = false;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const maxReconnectAttempts = 2;

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const closeStream = () => {
    clearReconnect();
    if (source) {
      source.close();
      source = null;
    }
  };

  const failPermanently = (reason: string) => {
    settled = true;
    closeStream();
    markBackendOffline();
    onError(reason);
  };

  const scheduleReconnect = async () => {
    if (settled || reconnectAttempts >= maxReconnectAttempts) {
      failPermanently('Connection lost');
      return;
    }

    try {
      const status = await getExecutionRun(runId);
      if (!status.active) {
        failPermanently('Connection lost');
        return;
      }
    } catch {
      failPermanently('Connection lost');
      return;
    }

    reconnectAttempts += 1;
    reconnectTimer = setTimeout(connect, 1200);
  };

  const connect = () => {
    if (settled) return;
    clearReconnect();
    source = new EventSource(`${BASE}/execute/runs/${runId}/stream`);
    source.onmessage = (message) => {
      let data: AgentEvent;
      try {
        data = JSON.parse(message.data) as AgentEvent;
      } catch {
        // Truncated SSE frame (backend crashed mid-write): ignore this chunk.
        return;
      }
      onEvent(data);
      if (data.type === 'done' || data.type === 'error') {
        settled = true;
        closeStream();
        if (data.type === 'done') onDone();
        else onError(data.action);
      }
    };
    source.onerror = () => {
      if (settled) {
        closeStream();
        return;
      }
      closeStream();
      void scheduleReconnect();
    };
  };


  connect();
  return source as EventSource;
}

export async function startRun(params: ExecutionRunRequest): Promise<{ run_id: string }> {
  const record = await createExecutionRun(params);
  return { run_id: record.run_id };
}

export async function stopRun(runId: string) {
  await fetch(`${BASE}/agent/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run_id: runId }),
  });
}

export function createEventStream(
  runId: string,
  params: ExecutionRunRequest,
  onEvent: (event: AgentEvent) => void,
  onDone: () => void,
  onError: (message: string) => void,
): EventSource {
  void params;
  return createExecutionEventStream(runId, onEvent, onDone, onError);
}

export interface MCPServerConfig {
  id: string;
  name: string;
  description: string;
  family: string;
  transport: MCPTransport;
  kind: ToolProviderKind;
  enabled: boolean;
  ready: boolean;
  status: MCPServerStatus;
  command?: string | null;
  args: string[];
  env: Record<string, string>;
  tool_names: string[];
  tags: string[];
  updated_at?: string | null;
  last_error?: string | null;
}

export interface MCPToolRecord {
  name: string;
  label: string;
  family: string;
  description: string;
  provider_id: string;
  provider_kind: ToolProviderKind;
  available: boolean;
}

export interface MCPServersResponse {
  servers: MCPServerConfig[];
}

export interface MCPToolsResponse {
  tools: MCPToolRecord[];
}

export interface MCPServerDraft {
  name: string;
  description?: string;
  family: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export async function getMcpServers(): Promise<MCPServersResponse> {
  const response = await fetch(`${BASE}/mcp/servers`);
  if (!response.ok) {
    throw new Error(await readError(response, `MCP servers fetch failed: ${response.status}`));
  }
  return response.json();
}

export async function createMcpServer(payload: MCPServerDraft): Promise<MCPServerConfig> {
  const response = await fetch(`${BASE}/mcp/servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `MCP server creation failed: ${response.status}`));
  }
  return response.json();
}

export async function updateMcpServer(serverId: string, payload: Partial<MCPServerDraft>): Promise<MCPServerConfig> {
  const response = await fetch(`${BASE}/mcp/servers/${serverId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `MCP server update failed: ${response.status}`));
  }
  return response.json();
}

export async function getMcpTools(): Promise<MCPToolsResponse> {
  const response = await fetch(`${BASE}/mcp/tools`);
  if (!response.ok) {
    throw new Error(await readError(response, `MCP tools fetch failed: ${response.status}`));
  }
  return response.json();
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

export async function getRemoteCommands(status?: RemoteCommandStatus): Promise<RemoteCommand[]> {
  const url = status ? `${BASE}/remote/commands?status=${status}` : `${BASE}/remote/commands`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await readError(response, `Remote commands fetch failed: ${response.status}`));
  }
  return response.json();
}

export async function getRemoteConfig(): Promise<RemoteConfig> {
  const response = await fetch(`${BASE}/remote/config`);
  if (!response.ok) {
    throw new Error(await readError(response, `Remote config failed: ${response.status}`));
  }
  return response.json();
}

export async function approveRemoteCommand(commandId: string, note?: string): Promise<RemoteCommand> {
  const response = await fetch(`${BASE}/remote/commands/${commandId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor: 'local-user', note }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Remote approve failed: ${response.status}`));
  }
  return response.json();
}

export async function rejectRemoteCommand(commandId: string, note?: string): Promise<RemoteCommand> {
  const response = await fetch(`${BASE}/remote/commands/${commandId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor: 'local-user', note }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Remote reject failed: ${response.status}`));
  }
  return response.json();
}

export async function claimRemoteCommand(commandId: string): Promise<RemoteCommand> {
  const response = await fetch(`${BASE}/remote/commands/${commandId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor: 'local-workspace' }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Remote claim failed: ${response.status}`));
  }
  return response.json();
}

export async function completeRemoteCommand(commandId: string, success: boolean, note?: string): Promise<RemoteCommand> {
  const response = await fetch(`${BASE}/remote/commands/${commandId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor: 'local-workspace', success, note }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Remote completion failed: ${response.status}`));
  }
  return response.json();
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

export async function validateConnector(
  connectorId: string,
  values: Record<string, string>,
): Promise<ConnectorValidationResponse> {
  const response = await fetch(`${BASE}/connectors/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connector_id: connectorId, values }),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Connector validation failed: ${response.status}`));
  }
  return response.json();
}

export type MobileHubChannelId =
  | 'telegram'
  | 'whatsapp'
  | 'webhook'
  | 'slack'
  | 'discord'
  | 'email'
  | 'sms'
  | 'push';
export type MobileHubDevicePlatform = 'android' | 'ios' | 'desktop' | 'web';
export type MobileHubDeviceRole = 'operator' | 'node' | 'viewer';
export type MobileHubDeviceStatus = 'online' | 'offline' | 'pairing';
export type MobileHubGatewayStatus = 'ready' | 'discovering' | 'pairing' | 'offline';

export interface MobileHubChannel {
  id: MobileHubChannelId;
  name: string;
  transport: string;
  enabled: boolean;
  configured: boolean;
  secret_hint?: string | null;
  description: string;
  relay_path?: string | null;
}

export interface MobileHubDevice {
  id: string;
  name: string;
  platform: MobileHubDevicePlatform;
  role: MobileHubDeviceRole;
  status: MobileHubDeviceStatus;
  last_seen?: string | null;
  battery_percent?: number | null;
  overlay_enabled: boolean;
  voice_wake_enabled: boolean;
  pair_code?: string | null;
}

export interface MobileHubGatewayState {
  enabled: boolean;
  status: MobileHubGatewayStatus;
  protocol_version: number;
  discovery_mode: string;
  host: string;
  port: number;
  tls_enabled: boolean;
  tls_fingerprint?: string | null;
  inbound_path: string;
  pairing_code?: string | null;
  connected_devices: number;
}

export interface MobileHubOverlayState {
  floating_dock: boolean;
  mobile_hud: boolean;
  voice_overlay: boolean;
  voice_wake: boolean;
  camera_hud: boolean;
  push_to_talk: string;
}

export interface MobileHubState {
  gateway: MobileHubGatewayState;
  devices: MobileHubDevice[];
  channels: MobileHubChannel[];
  overlays: MobileHubOverlayState;
  cli_commands?: Array<{ label: string; command: string; description: string }>;
  summary?: string;
}

export async function getMobileHubState(): Promise<MobileHubState> {
  const response = await fetch(`${BASE}/mobile-hub/state`);
  if (!response.ok) {
    throw new Error(await readError(response, `Mobile hub state failed: ${response.status}`));
  }
  return response.json();
}

export async function pairMobileHubDevice(payload: {
  name: string;
  platform: MobileHubDevicePlatform;
  role: MobileHubDeviceRole;
}): Promise<MobileHubState> {
  const response = await fetch(`${BASE}/mobile-hub/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Mobile hub pairing failed: ${response.status}`));
  }
  return response.json();
}

export async function updateMobileHubGateway(payload: Partial<MobileHubGatewayState>): Promise<MobileHubState> {
  const response = await fetch(`${BASE}/mobile-hub/gateway`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Mobile hub gateway update failed: ${response.status}`));
  }
  return response.json();
}

export async function updateMobileHubOverlay(payload: Partial<MobileHubOverlayState>): Promise<MobileHubState> {
  const response = await fetch(`${BASE}/mobile-hub/overlays`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Mobile hub overlay update failed: ${response.status}`));
  }
  return response.json();
}

export async function updateMobileHubChannel(
  channelId: MobileHubChannelId,
  payload: { enabled?: boolean; secret?: string },
): Promise<MobileHubState> {
  const response = await fetch(`${BASE}/mobile-hub/channels/${channelId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Mobile hub channel update failed: ${response.status}`));
  }
  return response.json();
}

// ── Telegram Bot API ──────────────────────────────────────────────────────────

export interface TelegramStatus {
  running: boolean;
  token_configured: boolean;
  chat_ids: number[];
}

export async function getTelegramStatus(): Promise<TelegramStatus> {
  const res = await fetch(`${BASE}/telegram/status`);
  if (!res.ok) throw new Error(`Failed to get Telegram status: ${res.status}`);
  return res.json();
}

export async function startTelegramBot(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/telegram/start`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Failed to start Telegram bot: ${res.status}`);
  }
  return res.json();
}

export async function stopTelegramBot(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/telegram/stop`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to stop Telegram bot: ${res.status}`);
  return res.json();
}

export async function restartTelegramBot(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/telegram/restart`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Failed to restart Telegram bot: ${res.status}`);
  }
  return res.json();
}

export async function updateTelegramConfig(config: {
  token?: string;
  chat_ids?: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/telegram/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Failed to update Telegram config: ${res.status}`);
  }
  return res.json();
}

export async function updateMobileHubDevice(
  deviceId: string,
  payload: Partial<Pick<MobileHubDevice, 'status' | 'overlay_enabled' | 'voice_wake_enabled' | 'battery_percent'>>,
): Promise<MobileHubState> {
  const response = await fetch(`${BASE}/mobile-hub/devices/${deviceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readError(response, `Mobile hub device update failed: ${response.status}`));
  }
  return response.json();
}
