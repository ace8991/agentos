/**
 * Desktop Commander — Client API
 * S'aligne exactement sur les endpoints du backend ace8991-agentos/backend/
 */
import { API_BASE_URL } from './api';

const DC = `${API_BASE_URL}/desktop-commander`;

// ─── Types ────────────────────────────────────────────────────────────

export interface DCConfig {
  allowed_directories: string[];
  blocked_commands: string[];
  max_read_lines: number;
  max_write_lines: number;
  home: string;
  version: string;
  enabled: boolean;
}

export interface DCFileResult {
  success: boolean;
  path?: string;
  content?: string;
  size_bytes?: number;
  truncated?: boolean;
  total_lines?: number;
  lines_read?: number;
  offset?: number;
  description?: string;
}

export interface DCWriteResult {
  success: boolean;
  path?: string;
  bytes_written?: number;
  description?: string;
}

export interface DCDirEntry {
  name: string;
  type: 'file' | 'directory' | 'unknown';
  size_bytes?: number | null;
  modified?: number;
  extension?: string | null;
}

export interface DCListResult {
  success: boolean;
  path?: string;
  items?: DCDirEntry[];
  total?: number;
  description?: string;
}

export interface DCSearchResult {
  success: boolean;
  results?: { path: string; name: string; snippet?: string }[];
  description?: string;
}

export interface DCCommandResult {
  success: boolean;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  timed_out?: boolean;
  command?: string;
  description?: string;
}

export interface DCFileInfo {
  success: boolean;
  path?: string;
  type?: 'file' | 'directory';
  size?: number;
  created?: number;
  modified?: number;
  line_count?: number;
  description?: string;
}

// ─── Helper ───────────────────────────────────────────────────────────

async function post<T>(endpoint: string, body: unknown): Promise<T> {
  const r = await fetch(`${DC}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: `HTTP ${r.status}` }));
    throw new Error(err.detail || `${endpoint} failed: ${r.status}`);
  }
  return r.json();
}

async function get<T>(endpoint: string): Promise<T> {
  const r = await fetch(`${DC}/${endpoint}`);
  if (!r.ok) throw new Error(`${endpoint} failed: ${r.status}`);
  return r.json();
}

// ─── Config / Health ──────────────────────────────────────────────────

export async function getDCConfig(): Promise<DCConfig> {
  return get<DCConfig>('config');
}

export async function checkDCHealth(): Promise<boolean> {
  try {
    const cfg = await getDCConfig();
    return cfg.enabled !== false;
  } catch {
    return false;
  }
}

// ─── File operations ──────────────────────────────────────────────────

export async function readFile(path: string, offset = 0, length?: number): Promise<DCFileResult> {
  return post<DCFileResult>('read-file', { path, offset, length });
}

export async function writeFile(path: string, content: string, mode: 'rewrite' | 'append' = 'rewrite'): Promise<DCWriteResult> {
  return post<DCWriteResult>('write-file', { path, content, mode });
}

export async function editBlock(filePath: string, oldString: string, newString: string): Promise<{ success: boolean; description?: string }> {
  return post('edit-block', { file_path: filePath, old_string: oldString, new_string: newString });
}

export async function listDirectory(path: string, depth = 1): Promise<DCListResult> {
  return post<DCListResult>('list-directory', { path, depth });
}

export async function createDirectory(path: string): Promise<{ success: boolean; description?: string }> {
  return post('create-directory', { path });
}

export async function moveFile(source: string, destination: string): Promise<{ success: boolean; description?: string }> {
  return post('move-file', { source, destination });
}

export async function getFileInfo(path: string): Promise<DCFileInfo> {
  return post<DCFileInfo>('get-file-info', { path });
}

export async function searchFiles(path: string, query: string, maxResults = 20): Promise<DCSearchResult> {
  return post<DCSearchResult>('search-files', { path, query, max_results: maxResults });
}

// ─── Terminal ─────────────────────────────────────────────────────────

export async function executeCommand(
  command: string,
  options: { shell?: string; timeout_ms?: number; cwd?: string } = {},
): Promise<DCCommandResult> {
  return post<DCCommandResult>('execute-command', {
    command,
    shell: options.shell ?? 'powershell',
    timeout_ms: options.timeout_ms ?? 30000,
    cwd: options.cwd,
  });
}

// ─── System info ──────────────────────────────────────────────────────

export async function getSystemInfo(): Promise<Record<string, unknown>> {
  return get('system-info');
}

// ─── Batch helpers ────────────────────────────────────────────────────

export async function readMultipleFiles(paths: string[]): Promise<{ path: string; result?: DCFileResult; error?: string }[]> {
  const results = await Promise.allSettled(paths.map(p => readFile(p)));
  return paths.map((path, i) => {
    const res = results[i];
    if (res.status === 'fulfilled') return { path, result: res.value };
    return { path, error: (res.reason as Error).message };
  });
}
