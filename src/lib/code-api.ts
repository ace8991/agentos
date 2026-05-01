/**
 * CodePage API client — pont entre le frontend CodePage et les endpoints backend.
 * Fournit des fonctions typées pour le filesystem, le terminal, git, et les projets.
 */

const BASE = () => {
  // Utilise le même mécanisme que api.ts
  const stored = typeof window !== 'undefined' ? localStorage.getItem('backend_url') : null;
  return stored || 'http://localhost:8000';
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FileItem {
  name: string;
  relative_path: string;
  type: 'file' | 'directory';
  size_bytes: number | null;
  modified: number;
  extension: string | null;
}

export interface ListDirectoryResponse {
  success: boolean;
  path: string;
  items: FileItem[];
  total: number;
  description?: string;
}

export interface ReadFileResponse {
  success: boolean;
  content?: string;
  lines_read?: number;
  total_lines?: number;
  offset?: number;
  description?: string;
}

export interface WriteFileResponse {
  success: boolean;
  path?: string;
  description?: string;
}

export interface SearchFilesResponse {
  success: boolean;
  results: Array<{
    path: string;
    filename: string;
    line?: number;
    snippet?: string;
    score?: number;
  }>;
  description?: string;
}

export interface ExecuteCommandResponse {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  timed_out: boolean;
  command: string;
  description?: string;
}

export interface GitCommandResponse {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  command: string;
  repo_path?: string;
  description?: string;
}

export interface OpenProjectResponse {
  success: boolean;
  path?: string;
  name?: string;
  project_type?: string;
  file_count?: number;
  dir_count?: number;
  total_size_bytes?: number;
  git_branch?: string | null;
  git_has_changes?: boolean;
  is_git_repo?: boolean;
  description?: string;
}

export interface FileInfoResponse {
  success: boolean;
  path?: string;
  type?: 'file' | 'directory';
  size?: number;
  created?: number;
  modified?: number;
  line_count?: number;
  description?: string;
}

export interface SSEEvent {
  event: 'stdout' | 'stderr' | 'exit' | 'error';
  data?: string;
  exit_code?: number;
  message?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function request<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE()}/desktop-commander${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Filesystem ──────────────────────────────────────────────────────────────

export async function listDirectory(path: string, depth = 1): Promise<ListDirectoryResponse> {
  return request<ListDirectoryResponse>('/list-directory', { path, depth });
}

export async function readFile(
  path: string,
  offset?: number,
  length?: number,
  maxBytes?: number,
): Promise<ReadFileResponse> {
  return request<ReadFileResponse>('/read-file', { path, offset, length, max_bytes: maxBytes });
}

export async function writeFile(
  path: string,
  content: string,
  mode: 'rewrite' | 'append' = 'rewrite',
): Promise<WriteFileResponse> {
  return request<WriteFileResponse>('/write-file', { path, content, mode });
}

export async function createDirectory(path: string): Promise<{ success: boolean; description?: string }> {
  return request('/create-directory', { path });
}

export async function getFileInfo(path: string): Promise<FileInfoResponse> {
  return request<FileInfoResponse>('/get-file-info', { path });
}

export async function searchFiles(
  query: string,
  path?: string,
  maxResults = 20,
): Promise<SearchFilesResponse> {
  return request<SearchFilesResponse>('/search-files', { query, path, max_results: maxResults });
}

// ─── Terminal / Command Execution ────────────────────────────────────────────

export async function executeCommand(
  command: string,
  shell = 'powershell',
  timeoutMs = 30000,
  cwd?: string,
): Promise<ExecuteCommandResponse> {
  return request<ExecuteCommandResponse>('/execute-command', {
    command,
    shell,
    timeout_ms: timeoutMs,
    cwd,
  });
}

/**
 * Exécute une commande avec streaming SSE.
 * Retourne une fonction d'annulation.
 */
export function executeCommandStream(
  command: string,
  onEvent: (event: SSEEvent) => void,
  onError: (err: Error) => void,
  onComplete: () => void,
  shell = 'powershell',
  timeoutMs = 30000,
  cwd?: string,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE()}/desktop-commander/execute-command-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, shell, timeout_ms: timeoutMs, cwd }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error');
        onError(new Error(`SSE error ${res.status}: ${text}`));
        onComplete();
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        onError(new Error('No response body'));
        onComplete();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          try {
            const parsed: SSEEvent = JSON.parse(trimmed.slice(6));
            onEvent(parsed);
            if (parsed.event === 'exit' || parsed.event === 'error') {
              onComplete();
              return;
            }
          } catch {
            // Ignore malformed JSON
          }
        }
      }
      onComplete();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      onError(err instanceof Error ? err : new Error(String(err)));
      onComplete();
    }
  })();

  return () => controller.abort();
}

// ─── Git ──────────────────────────────────────────────────────────────────────

export async function gitCommand(repoPath: string, command: string): Promise<GitCommandResponse> {
  return request<GitCommandResponse>('/git', { repo_path: repoPath, command });
}

/**
 * Raccourcis git pratiques.
 */
export async function gitStatus(repoPath: string): Promise<GitCommandResponse> {
  return gitCommand(repoPath, 'status --porcelain');
}

export async function gitBranch(repoPath: string): Promise<GitCommandResponse> {
  return gitCommand(repoPath, 'branch -a');
}

export async function gitCurrentBranch(repoPath: string): Promise<GitCommandResponse> {
  return gitCommand(repoPath, 'rev-parse --abbrev-ref HEAD');
}

export async function gitLog(repoPath: string, count = 10): Promise<GitCommandResponse> {
  return gitCommand(repoPath, `log --oneline -${count}`);
}

export async function gitDiff(repoPath: string, staged = false): Promise<GitCommandResponse> {
  return gitCommand(repoPath, staged ? 'diff --cached' : 'diff');
}

export async function gitCommit(repoPath: string, message: string): Promise<GitCommandResponse> {
  return gitCommand(repoPath, `commit -m "${message.replace(/"/g, '\\"')}"`);
}

export async function gitPush(repoPath: string, remote = 'origin', branch?: string): Promise<GitCommandResponse> {
  const branchArg = branch ? ` ${branch}` : '';
  return gitCommand(repoPath, `push ${remote}${branchArg}`);
}

export async function gitPull(repoPath: string, remote = 'origin', branch?: string): Promise<GitCommandResponse> {
  const branchArg = branch ? ` ${branch}` : '';
  return gitCommand(repoPath, `pull ${remote}${branchArg}`);
}

export async function gitAdd(repoPath: string, files = '.'): Promise<GitCommandResponse> {
  return gitCommand(repoPath, `add ${files}`);
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function openProject(path: string): Promise<OpenProjectResponse> {
  return request<OpenProjectResponse>('/open-project', { path });
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkDesktopCommanderHealth(): Promise<{
  success: boolean;
  ready: boolean;
  mode: string;
  tools: string[];
  description?: string;
}> {
  const res = await fetch(`${BASE()}/desktop-commander/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}
