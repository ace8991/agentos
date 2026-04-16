import { buildChatSystemPrompt } from '@/lib/system-prompt';

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

const getBase = () => {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  return `${window.location.protocol}//${window.location.hostname}:8000`;
};

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || getBase()).replace(/\/$/, '');
const BASE = API_BASE_URL;

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
  'gpt-5.4': 'gpt-4o',
  gpt5: 'gpt-4o',
  'deepseek-r1': 'deepseek-reasoner',
};

const VALID = new Set([
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
  'claude-opus-4-5',
  'claude-haiku-4-5',
  'gpt-4o',
  'gpt-4o-mini',
  'deepseek-chat',
  'deepseek-reasoner',
  'o3',
  'o3-mini',
  'o4-mini',
]);

export function normalizeModel(model: string): string {
  if (!model) return 'claude-sonnet-4-6';
  const lowered = model.toLowerCase();
  if (MODEL_FIX[lowered]) return MODEL_FIX[lowered];
  if (VALID.has(lowered)) return lowered;
  if (lowered.includes('deepseek')) return 'deepseek-chat';
  if (lowered.includes('gpt')) return 'gpt-4o';
  if (lowered.includes('opus')) return 'claude-opus-4-5';
  if (lowered.includes('haiku')) return 'claude-haiku-4-5';
  return 'claude-sonnet-4-6';
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
    images?: Array<{ media_type: string; data: string }>;
  },
): Promise<void> {
  const normalizedModel = normalizeModel(model);
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

  try {
    const response = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      onError(await readError(response, `Backend ${response.status}`));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('No response body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let hasContent = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        if (raw === '[DONE]') {
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
          } else if (event.type === 'content_block_delta' && event.delta?.text) {
            hasContent = true;
            onToken(event.delta.text);
          } else if (event.type === 'done') {
            onDone();
            return;
          } else if (event.type === 'error') {
            onError(event.content || event.error || 'Streaming error');
            return;
          }
        } catch {
          hasContent = true;
          onToken(raw);
        }
      }
    }

    if (!hasContent) {
      onError('No response - check backend connectivity and model configuration.');
    } else {
      onDone();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('fetch')) {
      onError('Cannot connect to backend (port 8000). Make sure it is running.');
    } else {
      onError(message);
    }
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
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) });
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

  const scheduleReconnect = async () => {
    if (settled || reconnectAttempts >= maxReconnectAttempts) {
      settled = true;
      onError('Connection lost');
      return;
    }

    try {
      const status = await getExecutionRun(runId);
      if (!status.active) {
        settled = true;
        onError('Connection lost');
        return;
      }
    } catch {
      settled = true;
      onError('Connection lost');
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
      const data: AgentEvent = JSON.parse(message.data);
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
