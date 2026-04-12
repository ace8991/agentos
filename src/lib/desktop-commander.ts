import { API_BASE_URL } from './api';

const DC = `${API_BASE_URL}/desktop-commander`;

export interface DCConfig {
  allowed_directories: string[];
  blocked_commands: string[];
  max_read_lines: number;
  max_write_lines: number;
  home: string;
  version: string;
  default_shell?: string;
  path_separator?: string;
  platform?: string;
  enabled?: boolean;
  ready?: boolean;
  description?: string;
}

export interface DCFileResult {
  success: boolean;
  path?: string;
  content?: string;
  size_bytes?: number;
  truncated?: boolean;
  encoding?: string;
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

export interface DCDirectoryEntry {
  name: string;
  type: 'file' | 'directory' | 'unknown';
  size_bytes?: number | null;
  modified?: number;
  extension?: string | null;
  error?: string;
}

export type DCDirEntry = DCDirectoryEntry;

export interface DCListResult {
  success: boolean;
  path?: string;
  items?: DCDirectoryEntry[];
  total?: number;
  description?: string;
}

export interface DCSearchEntry {
  path: string;
  name: string;
  snippet?: string;
}

export interface DCSearchResult {
  success: boolean;
  results?: DCSearchEntry[];
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
  permissions?: string;
  line_count?: number;
  description?: string;
}

export interface DCSystemInfoResult {
  success: boolean;
  os: string;
  os_version: string;
  hostname: string;
  cpu_count: number;
  cpu_percent: number;
  memory_total_gb: number;
  memory_used_gb: number;
  memory_percent: number;
  disk_total_gb: number;
  disk_free_gb: number;
  disk_percent: number;
  home_dir: string;
  description: string;
}

async function post<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${DC}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `${endpoint} failed: ${response.status}`);
  }

  return response.json();
}

async function get<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${DC}/${endpoint}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
    throw new Error(err.detail || `${endpoint} failed: ${response.status}`);
  }
  return response.json();
}

export async function getDCConfig(): Promise<DCConfig> {
  try {
    return await get<DCConfig>('config');
  } catch {
    const health = await get<{ ready?: boolean; description?: string }>('health');
    return {
      allowed_directories: [],
      blocked_commands: [],
      max_read_lines: 2000,
      max_write_lines: 2000,
      home: '',
      version: '1.0.0',
      ready: Boolean(health.ready),
      description: health.description,
    };
  }
}

export async function checkDCHealth(): Promise<boolean> {
  try {
    const config = await getDCConfig();
    return config.enabled !== false && config.ready !== false;
  } catch {
    return false;
  }
}

export async function readFile(path: string, offset = 0, length?: number): Promise<DCFileResult> {
  return post<DCFileResult>('read-file', { path, offset, length });
}

export async function writeFile(
  path: string,
  content: string,
  mode: 'rewrite' | 'append' = 'rewrite',
): Promise<DCWriteResult> {
  return post<DCWriteResult>('write-file', { path, content, mode });
}

export async function editBlock(
  filePath: string,
  oldString: string,
  newString: string,
): Promise<{ success: boolean; description?: string }> {
  return post('edit-block', { file_path: filePath, old_string: oldString, new_string: newString });
}

export async function listDirectory(path: string, depth = 1): Promise<DCListResult> {
  return post<DCListResult>('list-directory', { path, depth });
}

export async function createDirectory(path: string): Promise<{ success: boolean; description?: string }> {
  return post('create-directory', { path });
}

export async function moveFile(
  source: string,
  destination: string,
): Promise<{ success: boolean; description?: string }> {
  return post('move-file', { source, destination });
}

export async function getFileInfo(path: string): Promise<DCFileInfo> {
  return post<DCFileInfo>('get-file-info', { path });
}

export async function searchFiles(
  pathOrQuery: string,
  queryOrPath?: string,
  maxResults = 20,
): Promise<DCSearchResult> {
  const looksLikePath = /^[A-Za-z]:[\\/]/.test(pathOrQuery) || pathOrQuery.includes('/') || pathOrQuery.includes('\\');
  const path = looksLikePath ? pathOrQuery : queryOrPath;
  const query = looksLikePath ? (queryOrPath || '') : pathOrQuery;
  return post<DCSearchResult>('search-files', { query, path, max_results: maxResults });
}

export async function executeCommand(
  command: string,
  options: { shell?: string; timeout_ms?: number; cwd?: string } = {},
): Promise<DCCommandResult> {
  return post<DCCommandResult>('execute-command', {
    command,
    shell: options.shell,
    timeout_ms: options.timeout_ms,
    cwd: options.cwd,
  });
}

export async function getSystemInfo(): Promise<DCSystemInfoResult> {
  return get<DCSystemInfoResult>('system-info');
}

export async function readMultipleFiles(
  paths: string[],
): Promise<{ path: string; result?: DCFileResult; error?: string }[]> {
  const results = await Promise.allSettled(paths.map((path) => readFile(path)));
  return paths.map((path, index) => {
    const result = results[index];
    if (result.status === 'fulfilled') {
      return { path, result: result.value };
    }
    return { path, error: (result.reason as Error).message };
  });
}
