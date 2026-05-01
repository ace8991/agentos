import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, GitBranch, FolderOpen, Check, ChevronDown, Mic, Monitor,
  MessageSquare, Files, GitFork, Terminal as TerminalIcon,
  PanelLeftClose, PanelLeftOpen, PanelBottomClose, PanelBottomOpen,
  Send, Bot, User, Copy, Paperclip, X, Undo2, ChevronRight,
  Folder, File, Search, Plus, RefreshCw, ExternalLink, Clock,
  AlertCircle, GitPullRequest, Maximize2, Minimize2, Trash2, Loader2,
  Eye, SplitSquareHorizontal, Code2, Brain, Layers, FileText, Shield, ShieldCheck,
  GitCommitHorizontal,
} from 'lucide-react';
import Editor, { type OnMount } from '@monaco-editor/react';
import TaskSidebar from '@/components/TaskSidebar';
import AgentActionStep, { type ActionStep, type ActionStepType } from '@/components/code/AgentActionStep';
import ClaudeMdEditor from '@/components/code/ClaudeMdEditor';
import SubAgentPanel from '@/components/code/SubAgentPanel';
import HexLogo from '@/components/HexLogo';
import { PreviewPanel } from '@/components/code/PreviewPanel';
import { chatDirect } from '@/lib/api';
import ModelSelector from '@/components/ModelSelector';
import { useStore } from '@/store/useStore';
import {
  loadRepos, addRepo, removeRepo, switchBranch,
  getActiveRepo, setActiveRepoId, getGitHubToken,
  REPOS_UPDATED_EVENT, type GitHubRepo,
} from '@/lib/github-repos';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  listDirectory,
  readFile,
  writeFile,
  executeCommandStream,
  gitCommand,
  gitStatus,
  gitBranch,
  gitCurrentBranch,
  gitLog,
  gitDiff,
  gitCommit,
  gitPush,
  gitPull,
  gitAdd,
  openProject,
  searchFiles,
  type FileItem,
  type SSEEvent,
} from '@/lib/code-api';

// ─── Types ───────────────────────────────────────────────────────────
interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'agent-steps' | 'plan-approve';
  content: string;
  codeBlocks?: { language: string; code: string; file?: string }[];
  actionSteps?: ActionStep[];
  planApproved?: boolean;
}

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  language?: string;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  lineNum: number;
}

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────
const langColors: Record<string, string> = {
  tsx: 'text-blue-400', ts: 'text-blue-300', css: 'text-purple-400',
  py: 'text-yellow-400', json: 'text-green-400', txt: 'text-[hsl(0,0%,53%)]',
  html: 'text-orange-400', js: 'text-yellow-300', jsx: 'text-blue-400',
  md: 'text-gray-400', yml: 'text-red-300', yaml: 'text-red-300',
  toml: 'text-red-300', sh: 'text-green-300', bat: 'text-gray-400',
  ps1: 'text-blue-300', sql: 'text-orange-300', rs: 'text-orange-400',
  go: 'text-cyan-400', java: 'text-red-400', c: 'text-blue-400',
  cpp: 'text-blue-400', h: 'text-purple-400',
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
  const ext = path.split('.').pop()?.toLowerCase() || 'txt';
  return EXT_TO_LANGUAGE[ext] || 'plaintext';
}

function extractCodeBlocks(text: string): { language: string; code: string; file?: string }[] {
  const regex = /```(\w+)?\s*\n([\s\S]*?)```/g;
  const blocks: { language: string; code: string; file?: string }[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({ language: match[1] || 'text', code: match[2].trim() });
  }
  return blocks;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

// ─── File tree builder ───────────────────────────────────────────────
function buildFileTree(items: FileItem[]): FileNode[] {
  const root: FileNode[] = [];
  const map = new Map<string, FileNode>();

  for (const item of items) {
    const parts = item.relative_path.replace(/\\/g, '/').split('/');
    let currentPath = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!map.has(currentPath)) {
        const isLast = i === parts.length - 1;
        const node: FileNode = {
          name: part,
          type: isLast && item.type === 'file' ? 'file' : 'folder',
          children: isLast && item.type === 'file' ? undefined : [],
          language: isLast && item.type === 'file' ? part.split('.').pop() : undefined,
        };
        map.set(currentPath, node);
        if (i === 0) {
          root.push(node);
        } else {
          const parentPath = currentPath.slice(0, currentPath.lastIndexOf('/'));
          const parent = map.get(parentPath);
          if (parent && parent.children) {
            parent.children.push(node);
          }
        }
      }
    }
  }
  return root;
}

// ─── Sub-components ──────────────────────────────────────────────────

const FileTreeNode = ({ node, depth, path, selectedFile, onFileSelect }: {
  node: FileNode; depth: number; path: string; selectedFile?: string; onFileSelect?: (p: string) => void;
}) => {
  const [open, setOpen] = useState(depth < 1);
  const fullPath = `${path}/${node.name}`;
  const isSelected = selectedFile === fullPath;

  if (node.type === 'folder') {
    return (
      <div>
        <button onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-1.5 py-1 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)] rounded transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {open ? <FolderOpen size={13} className="text-[hsl(14,74%,52%)]/70" /> : <Folder size={13} className="text-[hsl(14,74%,52%)]/70" />}
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children?.map((child) => (
          <FileTreeNode key={child.name} node={child} depth={depth + 1} path={fullPath}
            selectedFile={selectedFile} onFileSelect={onFileSelect} />
        ))}
      </div>
    );
  }

  return (
    <button onClick={() => onFileSelect?.(fullPath)}
      className={`w-full flex items-center gap-1.5 py-1 px-2 text-xs rounded transition-colors ${
        isSelected ? 'bg-[hsl(0,0%,20%)] text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)]'
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}>
      <File size={12} className={langColors[node.language || ''] || 'text-muted-foreground'} />
      <span className="truncate">{node.name}</span>
    </button>
  );
};

// ─── Repo picker modal ───────────────────────────────────────────────
const RepoPickerModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [repos, setRepos] = useState<GitHubRepo[]>(loadRepos());
  const [inputVal, setInputVal] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const activeRepo = getActiveRepo();

  useEffect(() => {
    const h = () => setRepos(loadRepos());
    window.addEventListener(REPOS_UPDATED_EVENT, h);
    return () => window.removeEventListener(REPOS_UPDATED_EVENT, h);
  }, []);

  const handleAdd = async () => {
    if (!inputVal.trim()) return;
    setAdding(true);
    setError('');
    try {
      await addRepo(inputVal.trim(), getGitHubToken() || undefined);
      setInputVal('');
      setRepos(loadRepos());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setAdding(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,17%)] w-full sm:max-w-md sm:rounded-xl rounded-t-2xl max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(0,0%,17%)]">
          <h3 className="text-sm font-semibold text-foreground">Repositories GitHub</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X size={16} /></button>
        </div>

        <div className="px-4 py-3 border-b border-[hsl(0,0%,17%)] space-y-2">
          <div className="flex gap-2">
            <input value={inputVal} onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="owner/repo ou URL GitHub"
              className="flex-1 bg-[hsl(0,0%,15%)] border border-[hsl(0,0%,20%)] rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[hsl(14,74%,52%)] transition-colors" />
            <button onClick={handleAdd} disabled={adding || !inputVal.trim()}
              className="px-4 py-2 rounded-lg bg-[hsl(14,74%,52%)] text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 active:scale-[0.97] transition-transform whitespace-nowrap">
              {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Ajouter
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="overflow-y-auto max-h-[50vh]">
          {repos.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              <GitFork size={24} className="mx-auto mb-2 opacity-40" />
              <p>Aucun repository connecté</p>
              <p className="text-xs mt-1">Ajoutez un repo avec owner/repo ou une URL GitHub</p>
            </div>
          ) : (
            repos.map((repo) => (
              <div key={repo.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-[hsl(0,0%,14%)] cursor-pointer transition-colors ${
                  activeRepo?.id === repo.id ? 'bg-[hsl(14,74%,52%)]/8' : 'hover:bg-[hsl(0,0%,14%)]'
                }`}
                onClick={() => { setActiveRepoId(repo.id); onClose(); }}>
                <GitFork size={15} className="text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{repo.fullName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <GitBranch size={10} className="text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">{repo.branch}</span>
                    <span className="text-[10px] text-muted-foreground">· {timeAgo(repo.lastSync)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {activeRepo?.id === repo.id && (
                    <div className="w-2 h-2 rounded-full bg-[hsl(142,71%,45%)]" />
                  )}
                  <button onClick={(e) => { e.stopPropagation(); window.open(repo.url, '_blank'); }}
                    className="text-muted-foreground hover:text-foreground p-1"><ExternalLink size={13} /></button>
                  <button onClick={(e) => { e.stopPropagation(); removeRepo(repo.id); setRepos(loadRepos()); }}
                    className="text-muted-foreground hover:text-destructive p-1"><Trash2 size={13} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Branch picker ───────────────────────────────────────────────────
const BranchPicker = ({ repo, onClose }: { repo: GitHubRepo; onClose: () => void }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,17%)] w-full sm:max-w-xs sm:rounded-xl rounded-t-2xl max-h-[60vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(0,0%,17%)]">
          <h3 className="text-sm font-semibold text-foreground">Branches — {repo.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto max-h-[45vh]">
          {repo.branches.map((b) => (
            <button key={b}
              onClick={() => { switchBranch(repo.id, b); onClose(); }}
              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                repo.branch === b ? 'bg-[hsl(14,74%,52%)]/8 text-[hsl(14,74%,52%)]' : 'text-foreground hover:bg-[hsl(0,0%,14%)]'
              }`}>
              <GitBranch size={13} />
              <span className="truncate">{b}</span>
              {repo.branch === b && <Check size={13} className="ml-auto flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Git commit modal ────────────────────────────────────────────────
const GitCommitModal = ({ open, onClose, repoPath, onCommitted }: {
  open: boolean; onClose: () => void; repoPath?: string; onCommitted?: () => void;
}) => {
  const [message, setMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleCommit = async () => {
    if (!message.trim() || !repoPath) return;
    setCommitting(true);
    setResult(null);
    try {
      const addRes = await gitAdd(repoPath);
      if (!addRes.success) {
        setResult(`Erreur git add: ${addRes.stderr}`);
        setCommitting(false);
        return;
      }
      const commitRes = await gitCommit(repoPath, message.trim());
      if (commitRes.success) {
        setResult(`✓ Commit effectué: ${commitRes.stdout.trim() || commitRes.description}`);
        onCommitted?.();
        setTimeout(() => { onClose(); setMessage(''); setResult(null); }, 1500);
      } else {
        setResult(`Erreur: ${commitRes.stderr || commitRes.description}`);
      }
    } catch (err) {
      setResult(`Erreur: ${err instanceof Error ? err.message : 'Inconnue'}`);
    } finally {
      setCommitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,17%)] w-full sm:max-w-md sm:rounded-xl rounded-t-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(0,0%,17%)]">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <GitCommitHorizontal size={14} /> Commiter les changements
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message de commit..."
            rows={3}
            className="w-full bg-[hsl(0,0%,15%)] border border-[hsl(0,0%,20%)] rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[hsl(14,74%,52%)] transition-colors resize-none" />
          <button onClick={handleCommit} disabled={committing || !message.trim()}
            className="w-full px-4 py-2 rounded-lg bg-[hsl(14,74%,52%)] text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform">
            {committing ? <Loader2 size={14} className="animate-spin" /> : <GitCommitHorizontal size={14} />}
            {committing ? 'Commit en cours...' : 'Commiter'}
          </button>
          {result && (
            <p className={`text-xs ${result.startsWith('✓') ? 'text-[hsl(142,71%,45%)]' : 'text-destructive'}`}>{result}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
const CodePage = () => {
  const model = useStore((s) => s.model);
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();

  // GitHub state
  const [repos, setRepos] = useState<GitHubRepo[]>(loadRepos());
  const [activeRepoState, setActiveRepoState] = useState<GitHubRepo | null>(getActiveRepo());
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [showBranchPicker, setShowBranchPicker] = useState(false);

  useEffect(() => {
    const h = () => {
      setRepos(loadRepos());
      setActiveRepoState(getActiveRepo());
    };
    window.addEventListener(REPOS_UPDATED_EVENT, h);
    return () => window.removeEventListener(REPOS_UPDATED_EVENT, h);
  }, []);

  // Layout state
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [leftTab, setLeftTab] = useState<'files' | 'github' | 'memory'>('files');
  const [showSubAgents, setShowSubAgents] = useState(false);
  const [permissionMode, setPermissionMode] = useState<'ask' | 'auto'>('auto');
  const [showTerminal, setShowTerminal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Input bar state
  const [autoAccept, setAutoAccept] = useState(true);
  const [showCodeModelSelector, setShowCodeModelSelector] = useState(false);
  const [input, setInput] = useState('');

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: '1', role: 'assistant', content: 'Bonjour ! Décrivez ce que vous souhaitez créer ou modifier.' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Editor state
  const [viewMode, setViewMode] = useState<'code' | 'diff' | 'split' | 'preview'>('code');
  const [editableContent, setEditableContent] = useState<string | null>(null);
  const [diffAccepted, setDiffAccepted] = useState(false);
  const [pendingDiff, setPendingDiff] = useState<DiffLine[] | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  // Terminal state
  const [termLines, setTermLines] = useState<TerminalLine[]>([
    { id: '0', type: 'system', content: '# AgentOS Terminal v1.0' },
    { id: '1', type: 'system', content: "# Tapez une commande ou laissez l'IA exécuter pour vous." },
  ]);
  const [termInput, setTermInput] = useState('');
  const [termExpanded, setTermExpanded] = useState(false);
  const [termRunning, setTermRunning] = useState(false);
  const termBottomRef = useRef<HTMLDivElement>(null);
  const cancelTermRef = useRef<(() => void) | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quick Open (Ctrl+P) state
  const [showQuickOpen, setShowQuickOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState('');
  const [quickOpenResults, setQuickOpenResults] = useState<Array<{ path: string; filename: string }>>([]);
  const [quickOpenLoading, setQuickOpenLoading] = useState(false);
  const quickOpenRef = useRef<HTMLInputElement>(null);

  // File tree state (real from API)
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);
  const [fileTreeError, setFileTreeError] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [projectType, setProjectType] = useState<string | null>(null);

  // Recent projects (from localStorage)
  const [recentProjects, setRecentProjects] = useState<Array<{ path: string; name: string; type: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('codePage_recentProjects') || '[]'); }
    catch { return []; }
  });
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState<'node' | 'python' | 'static'>('node');
  const [creatingProject, setCreatingProject] = useState(false);

  const saveRecentProject = useCallback((path: string, name: string, type: string) => {
    setRecentProjects(prev => {
      const filtered = prev.filter(p => p.path !== path);
      const updated = [{ path, name, type }, ...filtered].slice(0, 10);
      localStorage.setItem('codePage_recentProjects', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Git state
  const [showGitCommitModal, setShowGitCommitModal] = useState(false);
  const [gitStatusText, setGitStatusText] = useState<string | null>(null);
  const [gitLoading, setGitLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ path: string; filename: string; snippet?: string }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isStreaming]);
  useEffect(() => { termBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [termLines]);

  // ─── Keyboard shortcuts ───────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P or Cmd+P → Quick Open
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowQuickOpen(prev => !prev);
        if (!showQuickOpen) {
          setQuickOpenQuery('');
          setQuickOpenResults([]);
          setTimeout(() => quickOpenRef.current?.focus(), 50);
        }
      }
      // Ctrl+Shift+F or Cmd+Shift+F → Focus search
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setShowLeftPanel(true);
        setLeftTab('files');
        // Focus the search input
        setTimeout(() => {
          const searchInput = document.querySelector<HTMLInputElement>('#code-search-input');
          searchInput?.focus();
          searchInput?.select();
        }, 100);
      }
      // Ctrl+` → Toggle terminal
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setShowTerminal(prev => !prev);
      }
      // Ctrl+B → Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setShowLeftPanel(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showQuickOpen]);

  // ─── Debounced search ─────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  // ─── Load file tree from API ──────────────────────────────
  const loadFileTree = useCallback(async (path: string) => {
    setFileTreeLoading(true);
    setFileTreeError(null);
    try {
      const res = await listDirectory(path, 4);
      if (res.success) {
        setFileTree(buildFileTree(res.items));
        setProjectPath(path);
      } else {
        setFileTreeError(res.description || 'Erreur de chargement');
      }
    } catch (err) {
      setFileTreeError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setFileTreeLoading(false);
    }
  }, []);

  // ─── Open project from file system ────────────────────────
  const handleOpenProject = useCallback(async (specificPath?: string) => {
    try {
      let resolvedPath = specificPath;
      if (!resolvedPath) {
        const dirHandle = await (window as any).showDirectoryPicker?.();
        if (!dirHandle) {
          // Fallback: try current directory
          const res = await openProject('.');
          if (res.success && res.path) {
            resolvedPath = res.path;
          }
        } else {
          resolvedPath = dirHandle.name;
        }
      }
      if (resolvedPath) {
        const res = await openProject(resolvedPath);
        if (res.success && res.path) {
          await loadFileTree(res.path);
          setShowLeftPanel(true);
          const detectedType = res.project_type || 'unknown';
          setProjectType(detectedType);
          saveRecentProject(res.path, res.name || res.path.split(/[/\\]/).pop() || res.path, detectedType);
        } else {
          setFileTreeError(res.description || "Impossible d'ouvrir le dossier");
        }
      }
    } catch {
      setFileTreeError("Impossible d'ouvrir le dossier");
    }
  }, [loadFileTree, saveRecentProject]);

  // ─── Create new project ───────────────────────────────────
  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const dirHandle = await (window as any).showDirectoryPicker?.();
      if (!dirHandle) return;
      const basePath = dirHandle.name;
      const projectDir = `${basePath}/${newProjectName.trim()}`;
      // Create basic project structure
      const { createDirectory, writeFile } = await import('@/lib/code-api');
      await createDirectory(projectDir);
      if (newProjectType === 'node') {
        await writeFile(`${projectDir}/package.json`, JSON.stringify({
          name: newProjectName.trim().toLowerCase().replace(/\s+/g, '-'),
          version: '1.0.0',
          private: true,
          scripts: { start: 'node index.js' },
        }, null, 2));
        await writeFile(`${projectDir}/index.js`, '// Entry point\n');
      } else if (newProjectType === 'python') {
        await writeFile(`${projectDir}/main.py`, '# Entry point\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n');
        await writeFile(`${projectDir}/requirements.txt`, '# Dependencies\n');
      } else {
        await writeFile(`${projectDir}/index.html`, '<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>' + newProjectName.trim() + '</title>\n</head>\n<body>\n  <h1>' + newProjectName.trim() + '</h1>\n</body>\n</html>\n');
      }
      await loadFileTree(projectDir);
      setShowLeftPanel(true);
      setProjectType(newProjectType);
      saveRecentProject(projectDir, newProjectName.trim(), newProjectType);
      setShowCreateProject(false);
      setNewProjectName('');
    } catch {
      // ignore
    } finally {
      setCreatingProject(false);
    }
  }, [newProjectName, newProjectType, loadFileTree, saveRecentProject]);

  // ─── Load file content from API ───────────────────────────
  const loadFileContent = useCallback(async (path: string) => {
    try {
      const res = await readFile(path);
      if (res.success && res.content !== undefined) {
        setEditableContent(res.content);
      } else {
        setEditableContent(`// Impossible de lire le fichier: ${res.description || 'Erreur inconnue'}`);
      }
    } catch (err) {
      setEditableContent(`// Erreur de lecture: ${err instanceof Error ? err.message : 'Erreur réseau'}`);
    }
  }, []);

  const getModelShortName = () => {
    const parts = model.split('-');
    if (model.includes('claude')) {
      const name = parts.find(p => ['sonnet', 'opus', 'haiku'].includes(p));
      const version = parts.slice(-1)[0];
      return `${name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Claude'} ${version}`;
    }
    if (model.includes('gpt')) return model.replace('gpt-', 'GPT-');
    if (model.includes('deepseek')) return 'DeepSeek';
    return model;
  };

  // ─── Real agentic tool execution ─────────────────────────
  // Maps tool names from the model to real backend API calls.
  const executeAgentTool = useCallback(async (
    toolName: string,
    args: Record<string, unknown>,
    stepsId: string,
    steps: ActionStep[],
  ): Promise<string> => {
    const addStep = (type: ActionStepType, label: string, detail?: string) => {
      const step: ActionStep = { id: `${stepsId}-${steps.length}`, type, status: 'running', label };
      steps.push(step);
      setMessages(prev => prev.map(m => m.id === stepsId ? { ...m, actionSteps: [...steps] } : m));
      return step;
    };
    const updateStep = (step: ActionStep, detail?: string, status?: 'done' | 'error') => {
      step.status = status || 'done';
      step.detail = detail;
      step.duration = Date.now() - (step as any)._start || 0;
      setMessages(prev => prev.map(m => m.id === stepsId ? { ...m, actionSteps: [...steps] } : m));
    };

    try {
      switch (toolName) {
        case 'read_file':
        case 'Read': {
          const step = addStep('read_file', `Lecture · ${(args.path || args.file_path) as string}`);
          const res = await readFile((args.path || args.file_path) as string);
          const content = res.success ? (res.content || '') : `Erreur: ${res.description}`;
          updateStep(step, content.slice(0, 300));
          return content;
        }

        case 'write_file':
        case 'Write': {
          const step = addStep('write_file', `Écriture · ${(args.path || args.file_path) as string}`);
          const res = await writeFile(
            (args.path || args.file_path) as string,
            (args.content || args.file_content) as string,
          );
          const msg = res.success ? '✓ Fichier écrit avec succès' : `Erreur: ${res.description}`;
          updateStep(step, msg, res.success ? 'done' : 'error');
          return msg;
        }

        case 'execute_command':
        case 'Bash':
        case 'execute': {
          const cmd = (args.command || args.cmd) as string;
          const step = addStep('bash', `$ ${cmd.slice(0, 80)}`);
          try {
            const res = await import('@/lib/code-api').then(m => m.executeCommand(
              cmd,
              undefined, 30000, projectPath || undefined,
            ));
            const output = res.success ? (res.stdout || '') : (res.stderr || res.description || '');
            const truncated = output.length > 1000 ? output.slice(0, 1000) + '\n... [truncated]' : output;
            updateStep(step, truncated || '(empty output)');
            return output || '(empty output)';
          } catch (err) {
            const msg = `Erreur: ${err instanceof Error ? err.message : 'Inconnue'}`;
            updateStep(step, msg, 'error');
            return msg;
          }
        }

        case 'search_files':
        case 'Search': {
          const query = (args.query || args.pattern) as string;
          const step = addStep('search', `Recherche: "${query}"`);
          const res = await searchFiles(query, projectPath || undefined, 15);
          if (res.success && res.results) {
            const results = res.results.map((r: any) => r.path).join('\n');
            updateStep(step, `${res.results.length} résultat(s) trouvé(s)`);
            return results || 'Aucun résultat';
          }
          updateStep(step, 'Aucun résultat');
          return 'Aucun résultat';
        }

        case 'list_directory':
        case 'List': {
          const dir = (args.path || args.directory) as string || projectPath || '.';
          const step = addStep('search', `Listage: ${dir}`);
          const res = await import('@/lib/code-api').then(m => m.listDirectory(dir, 2));
          if (res.success && res.items) {
            const listing = res.items.map((i: any) => `[${i.type}] ${i.relative_path}`).join('\n');
            updateStep(step, `${res.items.length} entrée(s)`);
            return listing;
          }
          updateStep(step, 'Erreur de listage', 'error');
          return 'Erreur de listage';
        }

        case 'think':
        case 'Think': {
          const thought = (args.thought || args.text) as string;
          const step = addStep('think', thought?.slice(0, 80) || 'Réflexion...');
          updateStep(step, thought?.slice(0, 200));
          return 'OK';
        }

        default:
          return `Outil "${toolName}" non reconnu. Outils disponibles: read_file, write_file, execute_command, search_files, list_directory, think.`;
      }
    } catch (err) {
      return `Erreur lors de l'exécution de "${toolName}": ${err instanceof Error ? err.message : 'Inconnue'}`;
    }
  }, [projectPath]);

  // ─── Agentic chat with real tools ────────────────────────
  const sendToChat = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    const stepsId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: stepsId, role: 'agent-steps', content: '', actionSteps: [] }]);

    const assistantId = (Date.now() + 2).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    let fullContent = '';
    const steps: ActionStep[] = [];
    let pendingToolCalls = 0;

    const systemPrompt = `Tu es un assistant de programmation expert intégré dans un IDE. Tu peux utiliser les outils suivants pour aider l'utilisateur:

1. **read_file** (path: string) — Lit le contenu d'un fichier.
2. **write_file** (path: string, content: string) — Écrit ou modifie un fichier.
3. **execute_command** (command: string) — Exécute une commande shell dans le répertoire du projet.
4. **search_files** (query: string) — Recherche des fichiers par nom ou contenu.
5. **list_directory** (path: string) — Liste le contenu d'un répertoire.
6. **think** (thought: string) — Réfléchis à voix haute avant d'agir.

Règles:
- Réponds TOUJOURS en français.
- Pour les tâches complexes, utilise les outils un par un.
- Après chaque action, attends le résultat avant de continuer.
- Quand tu as terminé, résume ce qui a été fait.`;

    chatDirect(
      [
        { role: 'system', content: systemPrompt },
        ...messages.filter(m => m.role === 'user' || (m.role === 'assistant' && m.content)).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: text },
      ],
      model, null, false,
      (token) => {
        fullContent += token;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m));
      },
      () => {
        const codeBlocks = extractCodeBlocks(fullContent);
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent, codeBlocks: codeBlocks.length > 0 ? codeBlocks : undefined } : m));
        setIsStreaming(false);
      },
      (err) => {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `Erreur: ${err}` } : m));
        setIsStreaming(false);
      },
      {
        onToolCall: async (event) => {
          pendingToolCalls++;
          const result = await executeAgentTool(event.tool, event.args, stepsId, steps);
          pendingToolCalls--;
          // Return the result via a synthetic tool_result event
          // The chatDirect function handles tool_result events from the backend,
          // but for client-side tool execution we need to feed results back.
          // We'll append the result as a follow-up message.
          if (pendingToolCalls === 0) {
            // All tools executed, send results back to the model
            const resultMsg = `[Résultat de l'outil "${event.tool}"]:\n\`\`\`\n${result.slice(0, 2000)}\n\`\`\`\n\nContinue ton raisonnement.`;
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content: resultMsg,
            }]);
          }
        },
      },
    );
  }, [messages, model, isStreaming, executeAgentTool]);

  const handleMainSubmit = () => { if (!input.trim()) return; setShowChat(true); sendToChat(input); setInput(''); };
  const handleChatSubmit = () => { if (!chatInput.trim()) return; sendToChat(chatInput); setChatInput(''); };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ─── Real terminal command execution ──────────────────────
  const handleTermCommand = () => {
    if (!termInput.trim() || termRunning) return;
    const cmd = termInput.trim();
    const cmdId = Date.now().toString();

    if (cmd === 'clear') {
      setTermLines([]);
      setTermInput('');
      return;
    }

    setTermLines(prev => [...prev, { id: cmdId, type: 'input', content: `$ ${cmd}` }]);
    setTermInput('');
    setTermRunning(true);

    const cancel = executeCommandStream(
      cmd,
      (event: SSEEvent) => {
        if (event.event === 'stdout' && event.data) {
          setTermLines(prev => [...prev, { id: `${cmdId}-${Date.now()}`, type: 'output', content: event.data! }]);
        } else if (event.event === 'stderr' && event.data) {
          setTermLines(prev => [...prev, { id: `${cmdId}-${Date.now()}`, type: 'error', content: event.data! }]);
        } else if (event.event === 'exit') {
          setTermLines(prev => [...prev, {
            id: `${cmdId}-exit`,
            type: 'system',
            content: `Process exited with code ${event.exit_code}`,
          }]);
          setTermRunning(false);
        } else if (event.event === 'error' && event.message) {
          setTermLines(prev => [...prev, { id: `${cmdId}-err`, type: 'error', content: `Erreur: ${event.message}` }]);
          setTermRunning(false);
        }
      },
      (err: Error) => {
        setTermLines(prev => [...prev, { id: `${cmdId}-err`, type: 'error', content: `Erreur: ${err.message}` }]);
        setTermRunning(false);
      },
      () => {
        setTermRunning(false);
      },
      undefined, undefined, projectPath || undefined,
    );
    cancelTermRef.current = cancel;
  };

  // ─── Git handlers ─────────────────────────────────────────
  const handleGitStatus = useCallback(async () => {
    if (!projectPath) return;
    setGitLoading(true);
    try {
      const res = await gitStatus(projectPath);
      if (res.success) {
        setGitStatusText(res.stdout || res.description || 'Aucun changement');
      } else {
        setGitStatusText(`Erreur: ${res.stderr || res.description}`);
      }
    } catch (err) {
      setGitStatusText(`Erreur: ${err instanceof Error ? err.message : 'Inconnue'}`);
    } finally {
      setGitLoading(false);
    }
  }, [projectPath]);

  const handleGitPush = useCallback(async () => {
    if (!projectPath) return;
    setGitLoading(true);
    try {
      const res = await gitPush(projectPath);
      setGitStatusText(res.success ? '✓ Push effectué' : `Erreur: ${res.stderr || res.description}`);
    } catch (err) {
      setGitStatusText(`Erreur: ${err instanceof Error ? err.message : 'Inconnue'}`);
    } finally {
      setGitLoading(false);
    }
  }, [projectPath]);

  const handleGitPull = useCallback(async () => {
    if (!projectPath) return;
    setGitLoading(true);
    try {
      const res = await gitPull(projectPath);
      setGitStatusText(res.success ? '✓ Pull effectué' : `Erreur: ${res.stderr || res.description}`);
    } catch (err) {
      setGitStatusText(`Erreur: ${err instanceof Error ? err.message : 'Inconnue'}`);
    } finally {
      setGitLoading(false);
    }
  }, [projectPath]);

  // ─── Search handler ───────────────────────────────────────
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await searchFiles(query, projectPath || undefined, 20);
      if (res.success && res.results) {
        setSearchResults(res.results.map((r: { path: string; filename: string; snippet?: string }) => ({
          path: r.path,
          filename: r.filename,
          snippet: r.snippet,
        })));
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  }, [projectPath]);

  // ─── File select handler ──────────────────────────────────
  const handleFileSelect = useCallback((path: string) => {
    setSelectedFile(path);
    loadFileContent(path);
  }, [loadFileContent]);

  // ─── Editor mount handler ─────────────────────────────────
  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-3 left-3 z-50 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)] transition-colors"
        title="Retour à l'accueil"
      >
        <ArrowLeft size={15} />
        <span className="hidden sm:inline">Retour</span>
      </button>

      {/* Left panel — files / github / memory */}
      {showLeftPanel && (
        <div className="w-[240px] shrink-0 border-r border-border bg-[hsl(0,0%,9%)] flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button onClick={() => setLeftTab('files')}
              className={`flex-1 py-2 text-[11px] font-medium transition-colors ${leftTab === 'files' ? 'text-foreground border-b-2 border-[hsl(14,74%,52%)]' : 'text-muted-foreground hover:text-foreground'}`}>
              <Files size={13} className="inline mr-1" />Fichiers
            </button>
            <button onClick={() => setLeftTab('github')}
              className={`flex-1 py-2 text-[11px] font-medium transition-colors ${leftTab === 'github' ? 'text-foreground border-b-2 border-[hsl(14,74%,52%)]' : 'text-muted-foreground hover:text-foreground'}`}>
              <GitFork size={13} className="inline mr-1" />GitHub
            </button>
            <button onClick={() => setLeftTab('memory')}
              className={`flex-1 py-2 text-[11px] font-medium transition-colors ${leftTab === 'memory' ? 'text-foreground border-b-2 border-[hsl(14,74%,52%)]' : 'text-muted-foreground hover:text-foreground'}`}>
              <Brain size={13} className="inline mr-1" />Mémoire
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {leftTab === 'files' && (
              <div className="p-2 space-y-2">
                {/* Search */}
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="code-search-input"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { setSearchQuery(''); setSearchResults([]); }
                      if (e.key === 'Enter' && searchResults.length > 0) {
                        handleFileSelect(searchResults[0].path);
                        setSearchQuery(''); setSearchResults([]);
                      }
                    }}
                    placeholder="Rechercher (Ctrl+P)..."
                    className="w-full bg-[hsl(0,0%,13%)] border border-[hsl(0,0%,18%)] rounded-md pl-7 pr-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-[hsl(14,74%,52%)]/50 transition-colors"
                  />
                  {searching && <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
                  {!searching && searchQuery.trim() && searchResults.length === 0 && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50">Aucun résultat</span>
                  )}
                </div>

                {/* Project header */}
                {projectPath && (
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                      <FolderOpen size={10} />
                      {projectPath}
                    </span>
                    <button onClick={() => loadFileTree(projectPath)} className="text-muted-foreground hover:text-foreground p-0.5">
                      <RefreshCw size={10} />
                    </button>
                  </div>
                )}

                {/* File tree or search results */}
                {searchQuery.trim() && searchResults.length > 0 ? (
                  <div className="space-y-0.5">
                    {searchResults.map((r) => {
                      const ext = r.filename.split('.').pop() || '';
                      const colorClass = langColors[ext] || 'text-muted-foreground';
                      return (
                        <button key={r.path}
                          onClick={() => { handleFileSelect(r.path); setSearchQuery(''); setSearchResults([]); }}
                          className="w-full text-left group">
                          <div className="flex items-center gap-1.5 py-1 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)] rounded transition-colors">
                            <File size={11} className={colorClass} />
                            <span className="truncate font-medium">{r.filename}</span>
                            <span className="text-[10px] text-muted-foreground/50 truncate ml-auto">{r.path.split('/').slice(0, -1).join('/')}</span>
                          </div>
                          {r.snippet && (
                            <div className="px-2 pb-1 text-[10px] text-muted-foreground/60 font-mono truncate group-hover:text-muted-foreground/80">
                              {r.snippet.slice(0, 120)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : fileTreeLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                  </div>
                ) : fileTreeError ? (
                  <div className="px-2 py-4 text-center">
                    <AlertCircle size={16} className="mx-auto mb-2 text-destructive" />
                    <p className="text-xs text-destructive mb-2">{fileTreeError}</p>
                    <button onClick={() => projectPath && loadFileTree(projectPath)}
                      className="text-xs text-[hsl(14,74%,52%)] hover:underline">Réessayer</button>
                  </div>
                ) : fileTree.length === 0 ? (
                  <div className="px-2 py-6 text-center space-y-2">
                    <FolderOpen size={20} className="mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground mb-2">Aucun projet ouvert</p>
                    <button onClick={handleOpenProject}
                      className="text-xs px-3 py-1.5 rounded-md bg-[hsl(14,74%,52%)] text-white hover:opacity-90 transition-opacity w-full">
                      <FolderOpen size={11} className="inline mr-1" />Ouvrir un projet
                    </button>
                    <button onClick={() => setShowCreateProject(true)}
                      className="text-xs px-3 py-1.5 rounded-md border border-[hsl(0,0%,18%)] text-foreground hover:bg-[hsl(0,0%,15%)] transition-colors w-full">
                      <Plus size={11} className="inline mr-1" />Nouveau projet
                    </button>
                    {recentProjects.length > 0 && (
                      <button onClick={() => setShowProjectPicker(true)}
                        className="text-xs px-3 py-1.5 rounded-md border border-[hsl(0,0%,18%)] text-foreground hover:bg-[hsl(0,0%,15%)] transition-colors w-full">
                        <History size={11} className="inline mr-1" />Projets récents
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {fileTree.map((node) => (
                      <FileTreeNode key={node.name} node={node} depth={0} path=""
                        selectedFile={selectedFile || undefined} onFileSelect={handleFileSelect} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {leftTab === 'github' && (
              <div className="p-3 space-y-3">
                <button onClick={() => setShowRepoModal(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(0,0%,13%)] border border-[hsl(0,0%,18%)] text-xs text-foreground hover:bg-[hsl(0,0%,16%)] transition-colors">
                  <GitFork size={14} />
                  Gérer les repositories
                </button>
                {activeRepoState && (
                  <div className="px-3 py-2 rounded-lg bg-[hsl(0,0%,13%)] border border-[hsl(0,0%,18%)]">
                    <p className="text-xs font-medium text-foreground truncate">{activeRepoState.fullName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <GitBranch size={10} className="text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{activeRepoState.branch}</span>
                    </div>
                    <button onClick={() => setShowBranchPicker(true)}
                      className="mt-2 text-[10px] text-[hsl(14,74%,52%)] hover:underline">
                      Changer de branche
                    </button>
                  </div>
                )}
              </div>
            )}

            {leftTab === 'memory' && (
              <div className="p-3 text-center text-muted-foreground">
                <Brain size={20} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs">Mémoire du projet</p>
                <p className="text-[10px] mt-1">Bientôt disponible</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-[hsl(0,0%,9%)]">
          <button onClick={() => setShowLeftPanel(!showLeftPanel)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)] transition-colors"
            title={`${showLeftPanel ? 'Masquer' : 'Afficher'} le panneau latéral (Ctrl+B)`}>
            {showLeftPanel ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </button>

          {/* Project name in toolbar */}
          {projectPath && (
            <>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[hsl(0,0%,13%)] border border-[hsl(0,0%,18%)] max-w-[200px]">
                <FolderOpen size={11} className="text-[hsl(14,74%,52%)] shrink-0" />
                <span className="text-[11px] text-foreground truncate">{projectPath.split(/[/\\]/).pop()}</span>
                {projectType && (
                  <span className="text-[9px] text-muted-foreground/60 px-1 py-0.5 rounded bg-[hsl(0,0%,18%)] uppercase shrink-0">{projectType}</span>
                )}
              </div>
              <div className="h-4 w-px bg-border" />
            </>
          )}

          <button onClick={() => setShowQuickOpen(true)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)] transition-colors"
            title="Rechercher un fichier (Ctrl+P)">
            <Search size={14} />
          </button>

          <div className="h-4 w-px bg-border" />

          <button onClick={() => setShowTerminal(!showTerminal)}
            className={`p-1 rounded transition-colors ${showTerminal ? 'text-[hsl(14,74%,52%)] bg-[hsl(14,74%,52%)]/10' : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)]'}`}
            title={(showTerminal ? 'Masquer' : 'Afficher') + ' le terminal (Ctrl+`)'}>
            <TerminalIcon size={14} />
          </button>

          <button onClick={() => setShowChat(!showChat)}
            className={`p-1 rounded transition-colors ${showChat ? 'text-[hsl(14,74%,52%)] bg-[hsl(14,74%,52%)]/10' : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)]'}`}
            title={showChat ? 'Masquer chat' : 'Afficher chat'}>
            <MessageSquare size={14} />
          </button>

          <div className="h-4 w-px bg-border" />

          {/* View mode */}
          <div className="flex items-center gap-0.5 bg-[hsl(0,0%,13%)] rounded-md p-0.5">
            <button onClick={() => setViewMode('code')}
              className={`p-1 rounded text-xs transition-colors ${viewMode === 'code' ? 'bg-[hsl(0,0%,20%)] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Code"><Code2 size={13} /></button>
            <button onClick={() => setViewMode('diff')}
              className={`p-1 rounded text-xs transition-colors ${viewMode === 'diff' ? 'bg-[hsl(0,0%,20%)] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Diff"><FileText size={13} /></button>
            <button onClick={() => setViewMode('split')}
              className={`p-1 rounded text-xs transition-colors ${viewMode === 'split' ? 'bg-[hsl(0,0%,20%)] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Split"><SplitSquareHorizontal size={13} /></button>
            <button onClick={() => setViewMode('preview')}
              className={`p-1 rounded text-xs transition-colors ${viewMode === 'preview' ? 'bg-[hsl(0,0%,20%)] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Preview"><Eye size={13} /></button>
          </div>

          <div className="flex-1" />

          {/* Git actions */}
          {projectPath && (
            <div className="flex items-center gap-1">
              <button onClick={handleGitStatus} disabled={gitLoading}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)] transition-colors disabled:opacity-50"
                title="Git status">
                {gitLoading ? <Loader2 size={13} className="animate-spin" /> : <GitBranch size={13} />}
              </button>
              <button onClick={handleGitPull} disabled={gitLoading}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)] transition-colors disabled:opacity-50"
                title="Git pull">
                <GitPullRequest size={13} />
              </button>
              <button onClick={() => setShowGitCommitModal(true)} disabled={gitLoading}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)] transition-colors disabled:opacity-50"
                title="Commit">
                <GitCommitHorizontal size={13} />
              </button>
              <button onClick={handleGitPush} disabled={gitLoading}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)] transition-colors disabled:opacity-50"
                title="Git push">
                <ExternalLink size={13} />
              </button>
            </div>
          )}

          {/* Permission mode */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <button onClick={() => setPermissionMode(p => p === 'ask' ? 'auto' : 'ask')}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${permissionMode === 'auto' ? 'text-[hsl(142,71%,45%)]' : 'text-muted-foreground'}`}>
              {permissionMode === 'auto' ? <ShieldCheck size={11} /> : <Shield size={11} />}
              {permissionMode === 'auto' ? 'Auto' : 'Ask'}
            </button>
          </div>

          {/* Model selector */}
          <button onClick={() => setShowCodeModelSelector(!showCodeModelSelector)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)] transition-colors">
            <Bot size={12} />
            {getModelShortName()}
          </button>
        </div>

        {/* Git status bar */}
        {gitStatusText && (
          <div className="flex items-center gap-2 px-3 py-1 bg-[hsl(14,74%,52%)]/5 border-b border-border">
            <span className="text-[10px] text-muted-foreground flex-1 truncate">{gitStatusText}</span>
            <button onClick={() => setGitStatusText(null)} className="text-muted-foreground hover:text-foreground p-0.5">
              <X size={10} />
            </button>
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 flex min-h-0">
          {/* Editor area */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedFile && editableContent !== null ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* File tab */}
                <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-[hsl(0,0%,10%)]">
                  <File size={11} className={langColors[selectedFile.split('.').pop() || ''] || 'text-muted-foreground'} />
                  <span className="text-xs text-foreground truncate">{selectedFile}</span>
                  <div className="flex-1" />
                  <button onClick={() => { setSelectedFile(null); setEditableContent(null); }}
                    className="text-muted-foreground hover:text-foreground p-0.5">
                    <X size={11} />
                  </button>
                </div>

                {/* Monaco Editor */}
                <div className="flex-1 min-h-0">
                  {viewMode === 'code' && (
                    <Editor
                      height="100%"
                      language={getLanguageFromPath(selectedFile)}
                      value={editableContent}
                      theme="vs-dark"
                      onChange={(val) => setEditableContent(val || '')}
                      onMount={handleEditorMount}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        wordWrap: 'off',
                        bracketPairColorization: { enabled: true },
                        renderWhitespace: 'selection',
                        padding: { top: 8 },
                      }}
                    />
                  )}
                  {viewMode === 'diff' && (
                    <div className="p-4 text-sm text-muted-foreground font-mono">
                      <p className="text-xs mb-2">Mode diff — sélectionnez un fichier avec des changements</p>
                      <pre className="text-xs text-[hsl(142,71%,45%)]">+ Ligne ajoutée</pre>
                      <pre className="text-xs text-destructive">- Ligne supprimée</pre>
                    </div>
                  )}
                  {viewMode === 'split' && (
                    <div className="flex h-full">
                      <div className="flex-1 min-w-0 border-r border-border">
                        <Editor
                          height="100%"
                          language={getLanguageFromPath(selectedFile)}
                          value={editableContent}
                          theme="vs-dark"
                          onMount={handleEditorMount}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 12,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            tabSize: 2,
                            readOnly: true,
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Editor
                          height="100%"
                          language={getLanguageFromPath(selectedFile)}
                          value={editableContent}
                          theme="vs-dark"
                          onChange={(val) => setEditableContent(val || '')}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 12,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            tabSize: 2,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {viewMode === 'preview' && (
                    <div className="p-4">
                      <PreviewPanel code={editableContent} language={getLanguageFromPath(selectedFile)} />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                  <HexLogo size={48} className="mx-auto mb-4 opacity-20" />
                  <h2 className="text-lg font-semibold text-foreground mb-2">AgentOS Code Studio</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ouvrez un projet pour commencer à coder, ou utilisez le chat pour décrire ce que vous voulez créer.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={handleOpenProject}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(14,74%,52%)] text-white text-sm font-medium hover:opacity-90 transition-opacity active:scale-[0.97]">
                      <FolderOpen size={15} />
                      Ouvrir un projet
                    </button>
                    <button onClick={() => setShowChat(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-[hsl(0,0%,15%)] transition-colors active:scale-[0.97]">
                      <MessageSquare size={15} />
                      Discuter
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat panel (right side) */}
          {showChat && (
            <div className="w-[380px] shrink-0 border-l border-border bg-[hsl(0,0%,9%)] flex flex-col">
              {/* Chat header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <MessageSquare size={13} />
                  Chat
                </span>
                <button onClick={() => setShowChat(false)}
                  className="text-muted-foreground hover:text-foreground p-0.5">
                  <X size={13} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id}>
                    {msg.role === 'user' && (
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-[hsl(14,74%,52%)]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User size={12} className="text-[hsl(14,74%,52%)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    )}
                    {msg.role === 'agent-steps' && msg.actionSteps && (
                      <AgentActionStep steps={msg.actionSteps} />
                    )}
                    {msg.role === 'assistant' && (
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-[hsl(0,0%,20%)] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot size={12} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-foreground whitespace-pre-wrap [&_code]:bg-[hsl(0,0%,15%)] [&_code]:px-1 [&_code]:rounded [&_code]:text-[10px]">
                            {msg.content}
                          </div>
                          {msg.codeBlocks?.map((block, i) => (
                            <div key={i} className="mt-2 rounded-lg overflow-hidden border border-[hsl(0,0%,17%)]">
                              <div className="flex items-center justify-between px-3 py-1.5 bg-[hsl(0,0%,13%)] border-b border-[hsl(0,0%,17%)]">
                                <span className="text-[10px] text-muted-foreground">{block.language}</span>
                                <button onClick={() => handleCopy(block.code, `${msg.id}-${i}`)}
                                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                                  {copiedId === `${msg.id}-${i}` ? <Check size={10} /> : <Copy size={10} />}
                                  {copiedId === `${msg.id}-${i}` ? 'Copié' : 'Copier'}
                                </button>
                              </div>
                              <pre className="p-3 text-xs text-foreground overflow-x-auto bg-[hsl(0,0%,10%)]"><code>{block.code}</code></pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {isStreaming && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="text-xs">Réflexion en cours...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat input */}
              <div className="p-3 border-t border-border">
                <div className="flex items-end gap-2 bg-[hsl(0,0%,13%)] rounded-lg border border-[hsl(0,0%,18%)] px-3 py-2">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } }}
                    placeholder="Message..."
                    rows={1}
                    className="flex-1 bg-transparent text-xs text-foreground outline-none resize-none placeholder:text-muted-foreground max-h-24"
                  />
                  <button onClick={handleChatSubmit} disabled={!chatInput.trim() || isStreaming}
                    className="p-1.5 rounded-md bg-[hsl(14,74%,52%)] text-white disabled:opacity-40 active:scale-[0.95] transition-all flex-shrink-0">
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Terminal panel (bottom) */}
        {showTerminal && (
          <div className={`border-t border-border bg-[hsl(0,0%,9%)] flex flex-col ${termExpanded ? 'flex-1' : 'h-[180px]'}`}>
            {/* Terminal header */}
            <div className="flex items-center justify-between px-3 py-1 border-b border-border">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <TerminalIcon size={11} />
                Terminal
                {termRunning && <Loader2 size={10} className="animate-spin text-[hsl(142,71%,45%)]" />}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setTermExpanded(!termExpanded)}
                  className="text-muted-foreground hover:text-foreground p-0.5">
                  {termExpanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                </button>
                <button onClick={() => setShowTerminal(false)}
                  className="text-muted-foreground hover:text-foreground p-0.5">
                  <X size={11} />
                </button>
              </div>
            </div>

            {/* Terminal output */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-2 font-mono">
              {termLines.map((line) => (
                <div key={line.id} className={`text-xs leading-5 ${
                  line.type === 'input' ? 'text-foreground' :
                  line.type === 'output' ? 'text-muted-foreground' :
                  line.type === 'error' ? 'text-destructive' :
                  'text-[hsl(142,71%,45%)]/70'
                }`}>
                  {line.content}
                </div>
              ))}
              <div ref={termBottomRef} />
            </div>

            {/* Terminal input */}
            <div className="px-2 py-1.5 border-t border-border">
              <div className="flex items-center gap-2 bg-[hsl(0,0%,13%)] rounded-md border border-[hsl(0,0%,18%)] px-2.5 py-1">
                <span className="text-xs text-[hsl(142,71%,45%)]">$</span>
                <input
                  value={termInput}
                  onChange={(e) => setTermInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleTermCommand(); } }}
                  placeholder={termRunning ? 'Commande en cours...' : 'Tapez une commande...'}
                  disabled={termRunning}
                  className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
                />
                {termRunning && (
                  <button onClick={() => { cancelTermRef.current?.(); setTermRunning(false); }}
                    className="p-0.5 text-muted-foreground hover:text-destructive">
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom input bar (when chat is hidden) */}
        {!showChat && (
          <div className="border-t border-border bg-[hsl(0,0%,9%)] px-3 py-2">
            <div className="flex items-end gap-2 bg-[hsl(0,0%,13%)] rounded-lg border border-[hsl(0,0%,18%)] px-3 py-2 max-w-3xl mx-auto">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleMainSubmit(); } }}
                placeholder="Décrivez ce que vous voulez créer ou modifier..."
                rows={1}
                className="flex-1 bg-transparent text-xs text-foreground outline-none resize-none placeholder:text-muted-foreground max-h-24"
              />
              <button onClick={handleMainSubmit} disabled={!input.trim() || isStreaming}
                className="p-1.5 rounded-md bg-[hsl(14,74%,52%)] text-white disabled:opacity-40 active:scale-[0.95] transition-all flex-shrink-0">
                <Send size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showRepoModal && <RepoPickerModal open={showRepoModal} onClose={() => setShowRepoModal(false)} />}
      {showBranchPicker && activeRepoState && (
        <BranchPicker repo={activeRepoState} onClose={() => setShowBranchPicker(false)} />
      )}
      {showGitCommitModal && (
        <GitCommitModal
          open={showGitCommitModal}
          onClose={() => { setShowGitCommitModal(false); setGitStatusText(null); }}
          repoPath={projectPath || undefined}
          onCommitted={() => { handleGitStatus(); }}
        />
      )}
      {showCodeModelSelector && (
        <div className="fixed bottom-20 right-4 z-50">
          <ModelSelector onClose={() => setShowCodeModelSelector(false)} />
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={() => { if (!creatingProject) { setShowCreateProject(false); setNewProjectName(''); } }}>
          <div className="fixed inset-0 bg-black/60" />
          <div className="relative w-full max-w-md bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,18%)] rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(0,0%,18%)]">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Plus size={14} className="text-[hsl(14,74%,52%)]" />
                Nouveau projet
              </h3>
              <button onClick={() => { setShowCreateProject(false); setNewProjectName(''); }}
                className="text-muted-foreground hover:text-foreground p-0.5">
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block">Nom du projet</label>
                <input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !creatingProject) handleCreateProject(); }}
                  placeholder="mon-projet"
                  className="w-full bg-[hsl(0,0%,13%)] border border-[hsl(0,0%,18%)] rounded-lg px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-[hsl(14,74%,52%)]/50 transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block">Type de projet</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['node', 'python', 'static'] as const).map((type) => (
                    <button key={type}
                      onClick={() => setNewProjectType(type)}
                      className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                        newProjectType === type
                          ? 'border-[hsl(14,74%,52%)] bg-[hsl(14,74%,52%)]/10 text-foreground'
                          : 'border-[hsl(0,0%,18%)] bg-[hsl(0,0%,13%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)]'
                      }`}>
                      {type === 'node' ? <TerminalIcon size={16} /> : type === 'python' ? <TerminalIcon size={16} /> : <Globe size={16} />}
                      <span className="text-[10px] font-medium capitalize">{type === 'static' ? 'Static' : type}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[hsl(0,0%,18%)] bg-[hsl(0,0%,9%)]">
              <button onClick={() => { setShowCreateProject(false); setNewProjectName(''); }}
                className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)] transition-colors">
                Annuler
              </button>
              <button onClick={handleCreateProject} disabled={!newProjectName.trim() || creatingProject}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[hsl(14,74%,52%)] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
                {creatingProject ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {creatingProject ? 'Création...' : 'Créer le projet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Picker (Recent Projects) */}
      {showProjectPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={() => setShowProjectPicker(false)}>
          <div className="fixed inset-0 bg-black/60" />
          <div className="relative w-full max-w-lg bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,18%)] rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(0,0%,18%)]">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <History size={14} className="text-[hsl(14,74%,52%)]" />
                Projets récents
              </h3>
              <button onClick={() => setShowProjectPicker(false)}
                className="text-muted-foreground hover:text-foreground p-0.5">
                <X size={14} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
              {recentProjects.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  Aucun projet récent
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  {recentProjects.map((proj) => (
                    <div key={proj.path}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[hsl(0,0%,15%)] transition-colors group cursor-pointer"
                      onClick={() => { handleOpenProject(proj.path); setShowProjectPicker(false); }}>
                      <FolderOpen size={14} className="text-[hsl(14,74%,52%)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate font-medium">{proj.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{proj.path}</p>
                      </div>
                      <span className="text-[9px] text-muted-foreground/60 px-1.5 py-0.5 rounded bg-[hsl(0,0%,18%)] uppercase shrink-0">{proj.type}</span>
                      <button onClick={(e) => {
                        e.stopPropagation();
                        setRecentProjects(prev => {
                          const updated = prev.filter(p => p.path !== proj.path);
                          localStorage.setItem('codePage_recentProjects', JSON.stringify(updated));
                          return updated;
                        });
                      }}
                        className="p-1 rounded text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-[hsl(0,0%,18%)] bg-[hsl(0,0%,9%)]">
              <button onClick={() => { setShowProjectPicker(false); setShowCreateProject(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-foreground hover:bg-[hsl(0,0%,15%)] transition-colors">
                <Plus size={12} />
                Nouveau projet
              </button>
              <button onClick={() => { handleOpenProject(); setShowProjectPicker(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(14,74%,52%)] text-white text-xs font-medium hover:opacity-90 transition-opacity">
                <FolderOpen size={12} />
                Ouvrir un autre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Open (Ctrl+P) */}
      {showQuickOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
          onClick={() => { setShowQuickOpen(false); setQuickOpenQuery(''); setQuickOpenResults([]); }}>
          <div className="fixed inset-0 bg-black/60" />
          <div className="relative w-full max-w-lg bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,18%)] rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[hsl(0,0%,18%)]">
              <Search size={14} className="text-muted-foreground shrink-0" />
              <input
                ref={quickOpenRef}
                value={quickOpenQuery}
                onChange={(e) => {
                  setQuickOpenQuery(e.target.value);
                  if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                  searchTimerRef.current = setTimeout(async () => {
                    const q = e.target.value.trim();
                    if (!q || !projectPath) { setQuickOpenResults([]); return; }
                    setQuickOpenLoading(true);
                    try {
                      const res = await searchFiles(q, projectPath, 30);
                      if (res.success && res.results) {
                        setQuickOpenResults(res.results.map((r: any) => ({ path: r.path, filename: r.filename })));
                      }
                    } catch { /* ignore */ }
                    setQuickOpenLoading(false);
                  }, 200);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setShowQuickOpen(false); setQuickOpenQuery(''); setQuickOpenResults([]); }
                  if (e.key === 'Enter' && quickOpenResults.length > 0) {
                    handleFileSelect(quickOpenResults[0].path);
                    setShowQuickOpen(false); setQuickOpenQuery(''); setQuickOpenResults([]);
                  }
                }}
                placeholder="Rechercher un fichier..."
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              {quickOpenLoading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
            </div>
            <div className="max-h-[50vh] overflow-y-auto scrollbar-thin">
              {quickOpenResults.length === 0 && quickOpenQuery.trim() && !quickOpenLoading && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Aucun fichier trouvé
                </div>
              )}
              {quickOpenResults.map((r, i) => {
                const ext = r.filename.split('.').pop() || '';
                const colorClass = langColors[ext] || 'text-muted-foreground';
                return (
                  <button key={r.path}
                    onClick={() => { handleFileSelect(r.path); setShowQuickOpen(false); setQuickOpenQuery(''); setQuickOpenResults([]); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-[hsl(0,0%,15%)] transition-colors ${i === 0 ? 'bg-[hsl(0,0%,15%)]' : ''}`}>
                    <File size={13} className={colorClass} />
                    <span className="text-xs text-foreground truncate flex-1">{r.filename}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{r.path}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3 px-4 py-1.5 border-t border-[hsl(0,0%,18%)] bg-[hsl(0,0%,9%)]">
              <span className="text-[10px] text-muted-foreground"><kbd className="px-1 py-0.5 rounded bg-[hsl(0,0%,15%)] border border-[hsl(0,0%,20%)] text-[9px]">↑↓</kbd> Naviguer</span>
              <span className="text-[10px] text-muted-foreground"><kbd className="px-1 py-0.5 rounded bg-[hsl(0,0%,15%)] border border-[hsl(0,0%,20%)] text-[9px]">↵</kbd> Ouvrir</span>
              <span className="text-[10px] text-muted-foreground"><kbd className="px-1 py-0.5 rounded bg-[hsl(0,0%,15%)] border border-[hsl(0,0%,20%)] text-[9px]">Esc</kbd> Fermer</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodePage;
