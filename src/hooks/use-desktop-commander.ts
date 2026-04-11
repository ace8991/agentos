/**
 * Hook React pour Desktop Commander
 * Expose les capacités fichier + terminal à tous les composants AgentOS.
 */
import { useState, useCallback, useRef } from 'react';
import {
  readFile,
  writeFile,
  editBlock,
  listDirectory,
  createDirectory,
  getFileInfo,
  moveFile,
  searchFiles,
  executeCommand,
  checkDCHealth,
  getDCConfig,
  type DCFileResult,
  type DCDirectoryEntry,
  type DCCommandResult,
  type DCConfig,
} from '@/lib/desktop-commander';

export interface DCStatus {
  online: boolean;
  checked: boolean;
  config: DCConfig | null;
}

export interface CommandHistoryEntry {
  id: string;
  command: string;
  result: DCCommandResult;
  timestamp: string;
}

export function useDesktopCommander() {
  const [status, setStatus] = useState<DCStatus>({
    online: false,
    checked: false,
    config: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // ─── Health check ─────────────────────────────────────────────────

  const checkHealth = useCallback(async () => {
    try {
      const config = await getDCConfig();
      setStatus({ online: true, checked: true, config });
    } catch {
      setStatus({ online: false, checked: true, config: null });
    }
  }, []);

  // ─── File operations ──────────────────────────────────────────────

  const read = useCallback(
    async (path: string, offset?: number, length?: number): Promise<DCFileResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await readFile(path, offset, length);
        return result;
      } catch (e) {
        setError((e as Error).message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const write = useCallback(
    async (
      path: string,
      content: string,
      mode: 'rewrite' | 'append' = 'rewrite',
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        await writeFile(path, content, mode);
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const edit = useCallback(
    async (
      filePath: string,
      oldString: string,
      newString: string,
      expectedReplacements = 1,
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        await editBlock(filePath, oldString, newString, expectedReplacements);
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const list = useCallback(
    async (path: string, depth = 2): Promise<DCDirectoryEntry[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await listDirectory(path, depth);
        return result.entries;
      } catch (e) {
        setError((e as Error).message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const mkdir = useCallback(async (path: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await createDirectory(path);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const fileInfo = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      return await getFileInfo(path);
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const move = useCallback(async (source: string, destination: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await moveFile(source, destination);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(
    async (path: string, pattern: string, recursive = true) => {
      setLoading(true);
      setError(null);
      try {
        return await searchFiles(path, pattern, recursive);
      } catch (e) {
        setError((e as Error).message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ─── Terminal ─────────────────────────────────────────────────────

  const runCommand = useCallback(
    async (
      command: string,
      options: { shell?: string; timeout_ms?: number; cwd?: string } = {},
    ): Promise<DCCommandResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await executeCommand(command, options);
        const entry: CommandHistoryEntry = {
          id: crypto.randomUUID(),
          command,
          result,
          timestamp: new Date().toISOString(),
        };
        setCommandHistory((h) => [entry, ...h].slice(0, 100));
        return result;
      } catch (e) {
        setError((e as Error).message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const clearHistory = useCallback(() => setCommandHistory([]), []);

  return {
    // Status
    status,
    loading,
    error,
    commandHistory,

    // Actions
    checkHealth,
    read,
    write,
    edit,
    list,
    mkdir,
    fileInfo,
    move,
    search,
    runCommand,
    clearHistory,
  };
}
