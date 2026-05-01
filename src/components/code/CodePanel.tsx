import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import {
  Folder, File, Search, Terminal as TerminalIcon, GitBranch,
  X, ChevronRight, ChevronDown, RefreshCw, Maximize2, Minimize2,
  Code2, FileText, GitCommitHorizontal, GitPullRequest,
  Send, Check, Loader2, Eye, SplitSquareHorizontal,
} from 'lucide-react';
import {
  listDirectory,
  readFile,
  writeFile,
  executeCommandStream,
  gitStatus,
  gitCurrentBranch,
  gitLog,
  gitDiff,
  gitCommit,
  gitPush,
  gitPull,
  gitAdd,
  searchFiles,
  type FileItem,
  type SSEEvent,
} from '@/lib/code-api';
import { PreviewPanel } from '@/components/code/PreviewPanel';

// ─── Types ───────────────────────────────────────────────────────────
interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  language?: string;
}

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
}

type CodePanelTab = 'files' | 'code' | 'terminal' | 'git';

// ─── Helpers ─────────────────────────────────────────────────────────
const langColors: Record<string, string> = {
  tsx: 'text-primary-400', ts: 'text-primary-300', css: 'text-primary-400',
  py: 'text-primary-400', json: 'text-primary-400', txt: 'text-[hsl(0,0%,53%)]',
  html: 'text-primary-400', js: 'text-primary-300', jsx: 'text-primary-400',
  md: 'text-muted-foreground', yml: 'text-primary-300', yaml: 'text-primary-300',
  toml: 'text-primary-300', sh: 'text-primary-300', bat: 'text-muted-foreground',
  ps1: 'text-primary-300', sql: 'text-primary-300', rs: 'text-primary-400',
  go: 'text-primary-400', java: 'text-primary-400', c: 'text-primary-400',
  cpp: 'text-primary-400', h: 'text-primary-400',
};

const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', css: 'css', html: 'html', json: 'json', md: 'markdown',
  yml: 'yaml', yaml: 'yaml', toml: 'toml', sh: 'shell', bat: 'bat',
  ps1: 'powershell', sql: 'sql', rs: 'rust', go: 'go', java: 'java',
  c: 'c', cpp: 'cpp', h: 'c', xml: 'xml', svg: 'xml', txt: 'plaintext',
  env: 'dotenv', gitignore: 'plaintext',
};

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_LANGUAGE[ext] || 'plaintext';
}

function buildFileTree(items: FileItem[]): FileNode[] {
  const root: FileNode[] = [];
  for (const item of items) {
    const parts = item.relative_path.replace(/\\/g, '/').split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const existing = current.find(
        (n) => n.name === part && n.type === (isLast && item.type === 'file' ? 'file' : 'folder'),
      );
      if (existing) {
        if (!isLast) current = existing.children || (existing.children = []);
      } else {
        const node: FileNode = {
          name: part,
          type: isLast && item.type === 'file' ? 'file' : 'folder',
          children: isLast ? undefined : [],
          language: isLast && item.type === 'file' ? getLanguageFromPath(item.relative_path) : undefined,
        };
        current.push(node);
        if (!isLast) current = node.children!;
      }
    }
  }
  return root;
}

// ─── Props ───────────────────────────────────────────────────────────
interface CodePanelProps {
  projectPath: string;
  projectType: string;
  onClose: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

// ─── FileTreeNode Component ──────────────────────────────────────────
const FileTreeNode = ({
  node, depth, path, selectedFile, onFileSelect,
}: {
  node: FileNode;
  depth: number;
  path: string;
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
}) => {
  const [open, setOpen] = useState(depth < 2);
  const fullPath = path ? `${path}/${node.name}` : node.name;
  const ext = node.name.split('.').pop()?.toLowerCase() || '';
  const colorClass = langColors[ext] || 'text-[hsl(0,0%,53%)]';

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-xs text-[hsl(0,0%,63%)] hover:bg-[hsl(0,0%,18%)] transition-colors"
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
        >
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <Folder size={12} className="text-[hsl(0,0%,43%)]" />
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children?.map((child) => (
          <FileTreeNode
            key={child.name}
            node={child}
            depth={depth + 1}
            path={fullPath}
            selectedFile={selectedFile}
            onFileSelect={onFileSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onFileSelect(fullPath)}
      className={`flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
        selectedFile === fullPath
          ? 'bg-[hsl(0,0%,22%)] text-white'
          : 'text-[hsl(0,0%,53%)] hover:bg-[hsl(0,0%,18%)]'
      }`}
      style={{ paddingLeft: `${depth * 12 + 18}px` }}
    >
      <File size={12} className={colorClass} />
      <span className="truncate">{node.name}</span>
    </button>
  );
};

// ─── CodePanel Component ─────────────────────────────────────────────
export const CodePanel: React.FC<CodePanelProps> = ({
  projectPath,
  projectType: _projectType,
  onClose,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [activeTab, setActiveTab] = useState<CodePanelTab>('files');

  // File tree state
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);
  const [fileTreeError, setFileTreeError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editableContent, setEditableContent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'code' | 'split' | 'preview'>('code');

  // Terminal state
  const [termLines, setTermLines] = useState<TerminalLine[]>([]);
  const [termInput, setTermInput] = useState('');
  const [termRunning, setTermRunning] = useState(false);
  const termEndRef = useRef<HTMLDivElement>(null);

  // Git state
  const [gitStatusData, setGitStatusData] = useState<string | null>(null);
  const [gitBranchName, setGitBranchName] = useState<string>('main');
  const [gitLogData, setGitLogData] = useState<string | null>(null);
  const [gitDiffData, setGitDiffData] = useState<string | null>(null);
  const [showGitCommit, setShowGitCommit] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [gitLoading, setGitLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ path: string; filename: string; snippet?: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ─── Load file tree ────────────────────────────────────────────────
  const loadFileTree = useCallback(async (path: string) => {
    if (!path) return;
    setFileTreeLoading(true);
    setFileTreeError(null);
    try {
      const res = await listDirectory(path);
      setFileTree(buildFileTree(res.items));
    } catch (err: any) {
      setFileTreeError(err.message || 'Failed to load file tree');
    } finally {
      setFileTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (projectPath) {
      loadFileTree(projectPath);
      loadGitInfo(projectPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath]);

  // ─── Load file content ─────────────────────────────────────────────
  const loadFileContent = useCallback(async (path: string) => {
    try {
      const res = await readFile(path);
      setEditableContent(res.content || '');
      setSelectedFile(path);
      setActiveTab('code');
    } catch (err: any) {
      setEditableContent(`// Error loading file: ${err.message}`);
      setSelectedFile(path);
      setActiveTab('code');
    }
  }, []);

  const handleFileSelect = useCallback(
    (path: string) => {
      loadFileContent(path);
    },
    [loadFileContent],
  );

  // ─── Save file ─────────────────────────────────────────────────────
  const handleSaveFile = useCallback(async () => {
    if (!selectedFile || editableContent === null) return;
    try {
      await writeFile(selectedFile, editableContent);
    } catch (err: any) {
      console.error('Save error:', err);
    }
  }, [selectedFile, editableContent]);

  // ─── Terminal ──────────────────────────────────────────────────────
  const handleTermCommand = useCallback(() => {
    const cmd = termInput.trim();
    if (!cmd || termRunning || !projectPath) return;
    setTermInput('');
    setTermRunning(true);
    setTermLines((prev) => [...prev, { id: crypto.randomUUID(), type: 'input', content: `$ ${cmd}` }]);

    executeCommandStream(
      cmd,
      (event: SSEEvent) => {
        if (event.event === 'stdout' || event.event === 'stderr') {
          setTermLines((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              type: event.event === 'stderr' ? 'error' : 'output',
              content: event.data || '',
            },
          ]);
        } else if (event.event === 'error') {
          setTermLines((prev) => [
            ...prev,
            { id: crypto.randomUUID(), type: 'error', content: event.message || 'Unknown error' },
          ]);
        }
      },
      (err: Error) => {
        setTermRunning(false);
        setTermLines((prev) => [...prev, { id: crypto.randomUUID(), type: 'error', content: err.message }]);
      },
      () => {
        setTermRunning(false);
      },
      'powershell',
      30000,
      projectPath,
    );
  }, [termInput, termRunning, projectPath]);

  useEffect(() => {
    termEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [termLines]);

  // ─── Git ───────────────────────────────────────────────────────────
  const loadGitInfo = useCallback(async (path: string) => {
    if (!path) return;
    setGitLoading(true);
    try {
      const [status, branch, log] = await Promise.all([
        gitStatus(path).catch(() => null),
        gitCurrentBranch(path).catch(() => null),
        gitLog(path, 10).catch(() => null),
      ]);
      if (status?.stdout) setGitStatusData(status.stdout);
      if (branch?.stdout) setGitBranchName(branch.stdout.trim());
      if (log?.stdout) setGitLogData(log.stdout);
    } catch {
      // Not a git repo
    } finally {
      setGitLoading(false);
    }
  }, []);

  const handleGitStatus = useCallback(async () => {
    if (!projectPath) return;
    setGitLoading(true);
    try {
      const data = await gitStatus(projectPath);
      setGitStatusData(data.stdout || '');
      setActiveTab('git');
    } catch (err: any) {
      setGitStatusData(`Error: ${err.message}`);
    } finally {
      setGitLoading(false);
    }
  }, [projectPath]);

  const handleGitDiff = useCallback(async () => {
    if (!projectPath) return;
    setGitLoading(true);
    try {
      const data = await gitDiff(projectPath);
      setGitDiffData(data.stdout || '');
    } catch (err: any) {
      setGitDiffData(`Error: ${err.message}`);
    } finally {
      setGitLoading(false);
    }
  }, [projectPath]);

  const handleGitCommit = useCallback(async () => {
    if (!projectPath || !commitMsg.trim()) return;
    setGitLoading(true);
    try {
      await gitAdd(projectPath, '.');
      await gitCommit(projectPath, commitMsg.trim());
      setCommitMsg('');
      setShowGitCommit(false);
      await loadGitInfo(projectPath);
    } catch (err: any) {
      console.error('Commit error:', err);
    } finally {
      setGitLoading(false);
    }
  }, [projectPath, commitMsg, loadGitInfo]);

  const handleGitPush = useCallback(async () => {
    if (!projectPath) return;
    setGitLoading(true);
    try {
      await gitPush(projectPath);
      await loadGitInfo(projectPath);
    } catch (err: any) {
      console.error('Push error:', err);
    } finally {
      setGitLoading(false);
    }
  }, [projectPath, loadGitInfo]);

  const handleGitPull = useCallback(async () => {
    if (!projectPath) return;
    setGitLoading(true);
    try {
      await gitPull(projectPath);
      await loadGitInfo(projectPath);
    } catch (err: any) {
      console.error('Pull error:', err);
    } finally {
      setGitLoading(false);
    }
  }, [projectPath, loadGitInfo]);

  // ─── Search ────────────────────────────────────────────────────────
  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim() || !projectPath) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const res = await searchFiles(query, projectPath);
        setSearchResults(res.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [projectPath],
  );

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (searchQuery.trim()) {
      searchTimerRef.current = setTimeout(() => handleSearch(searchQuery), 400);
    } else {
      setSearchResults([]);
    }
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, handleSearch]);

  // ─── Tabs ──────────────────────────────────────────────────────────
  const tabs: { id: CodePanelTab; label: string; icon: React.ReactNode }[] = [
    { id: 'files', label: 'Files', icon: <Folder size={12} /> },
    { id: 'code', label: 'Code', icon: <Code2 size={12} /> },
    { id: 'terminal', label: 'Terminal', icon: <TerminalIcon size={12} /> },
    { id: 'git', label: 'Git', icon: <GitBranch size={12} /> },
  ];

  const panelStyle: React.CSSProperties = isFullscreen
    ? { position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#0d0d0d' }
    : {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0d0d0d',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
      };

  const gitBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'inherit',
    background: 'transparent',
    color: '#ccc',
    transition: 'all 0.12s',
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="code-panel"
        style={panelStyle}
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 32, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        {/* ── Tabs ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 36,
            padding: '0 8px',
            gap: 2,
            background: '#0a0a0a',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            overflowX: 'auto',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '0 10px',
                height: 28,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'inherit',
                background: activeTab === tab.id ? 'rgba(255,255,255,0.07)' : 'transparent',
                color: activeTab === tab.id ? '#e5e5e5' : '#555',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                transition: 'background 0.12s, color 0.12s',
                borderBottom: activeTab === tab.id ? '2px solid #f97316' : '2px solid transparent',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: '#555',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            onClick={onClose}
            title="Close panel"
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: '#555',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={12} />
          </button>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* ── FILES TAB ── */}
          {activeTab === 'files' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Search bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 10px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <Search size={12} style={{ color: '#555', flexShrink: 0 }} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files..."
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#ccc',
                    fontSize: 12,
                    fontFamily: 'inherit',
                  }}
                />
                {searchLoading && <Loader2 size={12} style={{ color: '#555' }} className="animate-spin" />}
              </div>

              {/* File tree */}
              <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
                {fileTreeLoading ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#555', fontSize: 12 }}>
                    Loading...
                  </div>
                ) : fileTreeError ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#ef4444', fontSize: 12 }}>
                    {fileTreeError}
                  </div>
                ) : fileTree.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#555', fontSize: 12 }}>
                    No files found
                  </div>
                ) : (
                  fileTree.map((node) => (
                    <FileTreeNode
                      key={node.name}
                      node={node}
                      depth={0}
                      path=""
                      selectedFile={selectedFile}
                      onFileSelect={handleFileSelect}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── CODE TAB ── */}
          {activeTab === 'code' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Toolbar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 40,
                  padding: '0 10px',
                  gap: 6,
                  flexShrink: 0,
                  background: '#111',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: '#555',
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedFile || 'No file selected'}
                </span>
                <div
                  style={{
                    display: 'flex',
                    background: '#1a1a1a',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.07)',
                    padding: 2,
                    gap: 2,
                  }}
                >
                  {([
                    { m: 'code' as const, icon: <Code2 size={11} /> },
                    { m: 'split' as const, icon: <SplitSquareHorizontal size={11} /> },
                    { m: 'preview' as const, icon: <Eye size={11} /> },
                  ]).map(({ m, icon }) => (
                    <button
                      key={m}
                      onClick={() => setViewMode(m)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        border: 'none',
                        cursor: 'pointer',
                        background: viewMode === m ? '#252525' : 'transparent',
                        color: viewMode === m ? '#e5e5e5' : '#555',
                        transition: 'all 0.12s',
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                {selectedFile && (
                  <button
                    onClick={handleSaveFile}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontFamily: 'inherit',
                      background: '#1a6d3b',
                      color: '#e5e5e5',
                    }}
                  >
                    <Check size={11} />
                    Save
                  </button>
                )}
              </div>

              {/* Editor */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                {(viewMode === 'code' || viewMode === 'split') && (
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    {selectedFile && editableContent !== null ? (
                      <Editor
                        key={selectedFile}
                        height="100%"
                        language={getLanguageFromPath(selectedFile)}
                        value={editableContent}
                        onChange={(val) => setEditableContent(val || '')}
                        theme="vs-dark"
                        options={{
                          fontSize: 13,
                          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          fontLigatures: true,
                          lineHeight: 1.7,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          wordWrap: 'on',
                          padding: { top: 12, bottom: 12 },
                          readOnly: false,
                          bracketPairColorization: { enabled: true },
                          tabSize: 2,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          color: '#555',
                          fontSize: 13,
                        }}
                      >
                        Select a file from the Files tab
                      </div>
                    )}
                  </div>
                )}
                {viewMode === 'split' && (
                  <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
                )}
                {(viewMode === 'preview' || viewMode === 'split') && (
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    {selectedFile ? (
                      <PreviewPanel filePath={selectedFile} content={editableContent || ''} language={getLanguageFromPath(selectedFile)} />
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          color: '#555',
                          fontSize: 13,
                        }}
                      >
                        Select a file to preview
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TERMINAL TAB ── */}
          {activeTab === 'terminal' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: '8px 10px',
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: 12,
                  lineHeight: 1.6,
                  background: '#0a0a0a',
                }}
              >
                {termLines.length === 0 ? (
                  <div style={{ color: '#555', padding: '20px 0', textAlign: 'center' }}>
                    Enter a command to start
                  </div>
                ) : (
                  termLines.map((line) => (
                    <div
                      key={line.id}
                      style={{
                        color:
                          line.type === 'input'
                            ? '#4ade80'
                            : line.type === 'error'
                              ? '#ef4444'
                              : line.type === 'system'
                                ? '#f97316'
                                : '#ccc',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {line.content}
                    </div>
                  ))
                )}
                <div ref={termEndRef} />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                  background: '#111',
                }}
              >
                <span style={{ color: '#4ade80', fontSize: 12, fontFamily: 'monospace' }}>$</span>
                <input
                  value={termInput}
                  onChange={(e) => setTermInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTermCommand();
                  }}
                  placeholder="Type a command..."
                  disabled={termRunning}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#ccc',
                    fontSize: 12,
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={handleTermCommand}
                  disabled={!termInput.trim() || termRunning}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    border: 'none',
                    cursor: termInput.trim() && !termRunning ? 'pointer' : 'default',
                    background: termInput.trim() && !termRunning ? '#1a6d3b' : 'transparent',
                    color: termInput.trim() && !termRunning ? '#e5e5e5' : '#555',
                  }}
                >
                  <Send size={11} />
                </button>
              </div>
            </div>
          )}

          {/* ── GIT TAB ── */}
          {activeTab === 'git' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Git toolbar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 10px',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  background: '#111',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: '#f97316',
                    fontFamily: 'monospace',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(249,115,22,0.1)',
                  }}
                >
                  {gitBranchName}
                </span>
                <div style={{ flex: 1 }} />
                <button onClick={handleGitStatus} disabled={gitLoading} style={gitBtnStyle}>
                  <RefreshCw size={11} /> Status
                </button>
                <button onClick={handleGitDiff} disabled={gitLoading} style={gitBtnStyle}>
                  <FileText size={11} /> Diff
                </button>
                <button onClick={() => setShowGitCommit(!showGitCommit)} style={gitBtnStyle}>
                  <GitCommitHorizontal size={11} /> Commit
                </button>
                <button onClick={handleGitPush} disabled={gitLoading} style={gitBtnStyle}>
                  <GitPullRequest size={11} /> Push
                </button>
                <button onClick={handleGitPull} disabled={gitLoading} style={gitBtnStyle}>
                  <GitPullRequest size={11} style={{ transform: 'rotate(180deg)' }} /> Pull
                </button>
              </div>

              {/* Commit input */}
              {showGitCommit && (
                <div
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <input
                    value={commitMsg}
                    onChange={(e) => setCommitMsg(e.target.value)}
                    placeholder="Commit message..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGitCommit();
                    }}
                    style={{
                      flex: 1,
                      background: '#1a1a1a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      color: '#ccc',
                      fontSize: 12,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    onClick={handleGitCommit}
                    disabled={!commitMsg.trim() || gitLoading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: 'none',
                      cursor: commitMsg.trim() && !gitLoading ? 'pointer' : 'default',
                      background: commitMsg.trim() && !gitLoading ? '#1a6d3b' : '#333',
                      color: commitMsg.trim() && !gitLoading ? '#e5e5e5' : '#555',
                      fontSize: 11,
                      fontFamily: 'inherit',
                    }}
                  >
                    {gitLoading ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                    Commit
                  </button>
                </div>
              )}

              {/* Git output */}
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: '10px',
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: '#ccc',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {gitLoading && !gitStatusData && !gitDiffData && !gitLogData ? (
                  <div style={{ color: '#555', textAlign: 'center', padding: 20 }}>Loading...</div>
                ) : gitDiffData ? (
                  <div>
                    <div style={{ color: '#f97316', marginBottom: 8, fontSize: 12, fontWeight: 500 }}>Git Diff</div>
                    {gitDiffData.split('\n').map((line, i) => {
                      let color = '#ccc';
                      if (line.startsWith('+')) color = '#4ade80';
                      else if (line.startsWith('-')) color = '#ef4444';
                      else if (line.startsWith('@@')) color = '#f97316';
                      else if (line.startsWith('diff') || line.startsWith('index')) color = '#555';
                      return (
                        <div key={i} style={{ color }}>
                          {line}
                        </div>
                      );
                    })}
                  </div>
                ) : gitStatusData ? (
                  <div>
                    <div style={{ color: '#f97316', marginBottom: 8, fontSize: 12, fontWeight: 500 }}>Git Status</div>
                    {gitStatusData.split('\n').map((line, i) => (
                      <div
                        key={i}
                        style={{
                          color: line.includes('modified')
                            ? '#facc15'
                            : line.includes('new file')
                              ? '#4ade80'
                              : line.includes('deleted')
                                ? '#ef4444'
                                : '#ccc',
                        }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                ) : gitLogData ? (
                  <div>
                    <div style={{ color: '#f97316', marginBottom: 8, fontSize: 12, fontWeight: 500 }}>Git Log</div>
                    {gitLogData.split('\n').map((line, i) => (
                      <div key={i} style={{ color: i % 2 === 0 ? '#facc15' : '#ccc' }}>
                        {line}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#555', textAlign: 'center', padding: 20 }}>
                    No git data. Open a project with a git repository.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CodePanel;
