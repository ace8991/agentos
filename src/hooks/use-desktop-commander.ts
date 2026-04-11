/**
 * Hook React pour Desktop Commander
 * Aligné sur le backend ace8991-agentos/backend/
 */
import { useState, useCallback } from 'react';
import {
  readFile, writeFile, editBlock, listDirectory, createDirectory,
  getFileInfo, moveFile, searchFiles, executeCommand,
  checkDCHealth, getDCConfig,
  type DCFileResult, type DCDirEntry, type DCCommandResult, type DCConfig,
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
  const [status, setStatus] = useState<DCStatus>({ online: false, checked: false, config: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);

  // ─── Health check ────────────────────────────────────────────────
  const checkHealth = useCallback(async () => {
    try {
      const config = await getDCConfig();
      setStatus({ online: true, checked: true, config });
    } catch {
      setStatus({ online: false, checked: true, config: null });
    }
  }, []);

  // ─── File operations ──────────────────────────────────────────────
  const read = useCallback(async (path: string, offset?: number, length?: number): Promise<DCFileResult | null> => {
    setLoading(true); setError(null);
    try { return await readFile(path, offset, length); }
    catch (e) { setError((e as Error).message); return null; }
    finally { setLoading(false); }
  }, []);

  const write = useCallback(async (path: string, content: string, mode: 'rewrite' | 'append' = 'rewrite'): Promise<boolean> => {
    setLoading(true); setError(null);
    try { const r = await writeFile(path, content, mode); return r.success; }
    catch (e) { setError((e as Error).message); return false; }
    finally { setLoading(false); }
  }, []);

  const edit = useCallback(async (filePath: string, oldString: string, newString: string): Promise<boolean> => {
    setLoading(true); setError(null);
    try { const r = await editBlock(filePath, oldString, newString); return r.success; }
    catch (e) { setError((e as Error).message); return false; }
    finally { setLoading(false); }
  }, []);

  const list = useCallback(async (path: string, depth = 1): Promise<DCDirEntry[] | null> => {
    setLoading(true); setError(null);
    try {
      const result = await listDirectory(path, depth);
      return result.items ?? null;
    }
    catch (e) { setError((e as Error).message); return null; }
    finally { setLoading(false); }
  }, []);

  const mkdir = useCallback(async (path: string): Promise<boolean> => {
    setLoading(true); setError(null);
    try { const r = await createDirectory(path); return r.success; }
    catch (e) { setError((e as Error).message); return false; }
    finally { setLoading(false); }
  }, []);

  const fileInfo = useCallback(async (path: string) => {
    setLoading(true); setError(null);
    try { return await getFileInfo(path); }
    catch (e) { setError((e as Error).message); return null; }
    finally { setLoading(false); }
  }, []);

  const move = useCallback(async (source: string, destination: string): Promise<boolean> => {
    setLoading(true); setError(null);
    try { const r = await moveFile(source, destination); return r.success; }
    catch (e) { setError((e as Error).message); return false; }
    finally { setLoading(false); }
  }, []);

  const search = useCallback(async (path: string, query: string, maxResults = 20) => {
    setLoading(true); setError(null);
    try { return await searchFiles(path, query, maxResults); }
    catch (e) { setError((e as Error).message); return null; }
    finally { setLoading(false); }
  }, []);

  // ─── Terminal ─────────────────────────────────────────────────────
  const runCommand = useCallback(async (command: string, options: { shell?: string; timeout_ms?: number; cwd?: string } = {}): Promise<DCCommandResult | null> => {
    setLoading(true); setError(null);
    try {
      const result = await executeCommand(command, options);
      setCommandHistory(h => [{ id: crypto.randomUUID(), command, result, timestamp: new Date().toISOString() }, ...h].slice(0, 100));
      return result;
    }
    catch (e) { setError((e as Error).message); return null; }
    finally { setLoading(false); }
  }, []);

  const clearHistory = useCallback(() => setCommandHistory([]), []);

  return {
    status, loading, error, commandHistory,
    checkHealth, read, write, edit, list, mkdir, fileInfo, move, search, runCommand, clearHistory,
  };
}
