/**
 * Desktop Commander API Client
 * Donne à AgentOS les mêmes capacités que le MCP Desktop Commander
 * dans Claude.ai : fichiers, terminal, recherche, création de répertoires.
 */

import { API_BASE_URL } from './api';

const DC = `${API_BASE_URL}/desktop-commander`;

// ─── Types ────────────────────────────────────────────────────────────

export interface DCFileResult {
  type: 'text' | 'image';
  path: string;
  content?: string;
  base64?: string;
  mime?: string;
  total_lines?: number;
  offset?: number;
  lines_read?: number;
  truncated?: boolean;
}

export interface DCWriteResult {
  path: string;
  mode: string;
  lines_written: number;
  success: boolean;
  warning?: string;
}

export interface DCDirectoryEntry {
  name: string;
  type: 'file' | 'directory' | 'denied';
  path: string;
  size?: number;
  children?: DCDirectoryEntry[];
}

export interface DCListResult {
  path: string;
  entries: DCDirectoryEntry[];
}

export interface DCFileInfo {
  path: string;
  type: 'file' | 'directory';
  size: number;
  created: number;
  modified: number;
  permissions: string;
  line_count?: number;
}

export interface DCCommandResult {
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  timed_out: boolean;
}

export interface DCSearchResult {
  path: string;
  pattern: string;
  results: string[];
  count: number;
}

export interface DCConfig {
  allowed_directories: string[];
  blocked_commands: string[];
  max_read_lines: number;
  max_write_lines: number;
  home: string;
  version: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

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

// ─── Filesystem API ───────────────────────────────────────────────────

/** Lire un fichier (texte ou image). Supporte la pagination par lignes. */
export async function readFile(
  path: string,
  offset = 0,
  length?: number,
): Promise<DCFileResult> {
  return post('read-file', { path, offset, length });
}

/** Écrire ou ajouter du contenu à un fichier. */
export async function writeFile(
  path: string,
  content: string,
  mode: 'rewrite' | 'append' = 'rewrite',
): Promise<DCWriteResult> {
  return post('write-file', { path, content, mode });
}

/** Remplacer une chaîne unique dans un fichier (find & replace chirurgical). */
export async function editBlock(
  filePath: string,
  oldString: string,
  newString: string,
  expectedReplacements = 1,
): Promise<{ path: string; replacements: number; success: boolean }> {
  return post('edit-block', {
    file_path: filePath,
    old_string: oldString,
    new_string: newString,
    expected_replacements: expectedReplacements,
  });
}

/** Créer un répertoire (y compris les parents). */
export async function createDirectory(
  path: string,
): Promise<{ path: string; created: boolean }> {
  return post('create-directory', { path });
}

/** Lister un répertoire avec profondeur configurable. */
export async function listDirectory(
  path: string,
  depth = 2,
): Promise<DCListResult> {
  return post('list-directory', { path, depth });
}

/** Obtenir les métadonnées d'un fichier ou répertoire. */
export async function getFileInfo(path: string): Promise<DCFileInfo> {
  return post('get-file-info', { path });
}

/** Déplacer ou renommer un fichier. */
export async function moveFile(
  source: string,
  destination: string,
): Promise<{ source: string; destination: string; success: boolean }> {
  return post('move-file', { source, destination });
}

/** Rechercher des fichiers par pattern glob. */
export async function searchFiles(
  path: string,
  pattern: string,
  recursive = true,
): Promise<DCSearchResult> {
  return post('search-files', { path, pattern, recursive });
}

// ─── Terminal API ─────────────────────────────────────────────────────

/** Exécuter une commande shell (PowerShell par défaut). */
export async function executeCommand(
  command: string,
  options: {
    shell?: 'powershell' | 'cmd' | string;
    timeout_ms?: number;
    cwd?: string;
  } = {},
): Promise<DCCommandResult> {
  return post('execute-command', {
    command,
    shell: options.shell ?? 'powershell',
    timeout_ms: options.timeout_ms ?? 30000,
    cwd: options.cwd,
  });
}

// ─── Config / Status ──────────────────────────────────────────────────

/** Vérifier que le service Desktop Commander est actif et obtenir sa config. */
export async function getDCConfig(): Promise<DCConfig> {
  const r = await fetch(`${DC}/config`);
  if (!r.ok) throw new Error(`Desktop Commander offline: ${r.status}`);
  return r.json();
}

export async function checkDCHealth(): Promise<boolean> {
  try {
    await getDCConfig();
    return true;
  } catch {
    return false;
  }
}

// ─── Batch helpers ────────────────────────────────────────────────────

/**
 * Lire plusieurs fichiers en parallèle.
 * Equivalent de read_multiple_files du MCP.
 */
export async function readMultipleFiles(
  paths: string[],
): Promise<{ path: string; result?: DCFileResult; error?: string }[]> {
  const results = await Promise.allSettled(paths.map((p) => readFile(p)));
  return paths.map((path, i) => {
    const res = results[i];
    if (res.status === 'fulfilled') return { path, result: res.value };
    return { path, error: (res.reason as Error).message };
  });
}
