import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  GitBranch, FolderOpen, Check, ChevronDown, Mic, Monitor,
  MessageSquare, Files, GitFork, Terminal as TerminalIcon,
  PanelLeftClose, PanelLeftOpen, PanelBottomClose, PanelBottomOpen,
  Send, Bot, User, Copy, Paperclip, X, Undo2, ChevronRight,
  Folder, File, Search, Plus, RefreshCw, ExternalLink, Clock,
  AlertCircle, GitPullRequest, Maximize2, Minimize2, Trash2, Loader2,
  Eye, SplitSquareHorizontal, Code2,
} from 'lucide-react';
import TaskSidebar from '@/components/TaskSidebar';
import HexLogo from '@/components/HexLogo';
import { PreviewPanel } from '@/components/code/PreviewPanel';
import { chatDirect, type ChatMessage as ChatMessageType } from '@/lib/api';
import ModelSelector from '@/components/ModelSelector';
import { useStore } from '@/store/useStore';
import {
  loadRepos, addRepo, removeRepo, switchBranch,
  getActiveRepo, setActiveRepoId, getGitHubToken,
  REPOS_UPDATED_EVENT, type GitHubRepo,
} from '@/lib/github-repos';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

// ─── Types ───────────────────────────────────────────────────────────
interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  codeBlocks?: { language: string; code: string; file?: string }[];
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

// ─── Data ────────────────────────────────────────────────────────────
const defaultTree: FileNode[] = [
  { name: 'src', type: 'folder', children: [
    { name: 'components', type: 'folder', children: [
      { name: 'ChatPanel.tsx', type: 'file', language: 'tsx' },
      { name: 'HexLogo.tsx', type: 'file', language: 'tsx' },
      { name: 'SettingsModal.tsx', type: 'file', language: 'tsx' },
    ]},
    { name: 'pages', type: 'folder', children: [
      { name: 'Index.tsx', type: 'file', language: 'tsx' },
      { name: 'Dashboard.tsx', type: 'file', language: 'tsx' },
      { name: 'CodePage.tsx', type: 'file', language: 'tsx' },
    ]},
    { name: 'App.tsx', type: 'file', language: 'tsx' },
    { name: 'main.tsx', type: 'file', language: 'tsx' },
    { name: 'index.css', type: 'file', language: 'css' },
  ]},
  { name: 'preview', type: 'folder', children: [
    { name: 'demo.html', type: 'file', language: 'html' },
  ]},
  { name: 'backend', type: 'folder', children: [
    { name: 'app', type: 'folder', children: [
      { name: 'main.py', type: 'file', language: 'py' },
      { name: 'config.py', type: 'file', language: 'py' },
    ]},
    { name: 'requirements.txt', type: 'file', language: 'txt' },
  ]},
  { name: 'package.json', type: 'file', language: 'json' },
  { name: 'tsconfig.json', type: 'file', language: 'json' },
];

const sampleFileContents: Record<string, string> = {
  '/src/App.tsx': `import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const CodePage = lazy(() => import("./pages/CodePage"));

const App = () => (
  <BrowserRouter>
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/code" element={<CodePage />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default App;`,
  '/src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
  '/src/index.css': `/* AgentOS — Global Styles */
:root {
  --primary: #e8643a;
  --bg: #0f0f0f;
  --surface: #1a1a1a;
  --text: #e8e8e8;
  --border: #2a2a2a;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  margin: 16px;
}

.btn {
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.btn:hover { opacity: 0.9; }`,
  '/preview/demo.html': `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AgentOS Preview</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
    color: #e8e8e8;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 40px;
    max-width: 400px;
    width: 100%;
    text-align: center;
    backdrop-filter: blur(20px);
  }
  .logo { font-size: 40px; margin-bottom: 16px; }
  h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
  p { color: rgba(255,255,255,0.6); font-size: 14px; margin-bottom: 24px; }
  .btn {
    background: #e8643a;
    color: white;
    border: none;
    border-radius: 10px;
    padding: 12px 28px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
  }
  .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(232,100,58,0.4); }
  .stats { display: flex; gap: 20px; margin-top: 24px; justify-content: center; }
  .stat { text-align: center; }
  .stat-num { font-size: 22px; font-weight: 700; color: #e8643a; }
  .stat-label { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">⬡</div>
    <h1>AgentOS Pro</h1>
    <p>L'agent IA qui prend le contrôle de votre PC pour accomplir n'importe quelle tâche.</p>
    <button class="btn" onclick="this.textContent='🚀 Launched!'">Démarrer l'agent</button>
    <div class="stats">
      <div class="stat"><div class="stat-num">10+</div><div class="stat-label">Outils</div></div>
      <div class="stat"><div class="stat-num">∞</div><div class="stat-label">Tâches</div></div>
      <div class="stat"><div class="stat-num">100%</div><div class="stat-label">Local</div></div>
    </div>
  </div>
</body>
</html>`,
};

const sampleDiff: DiffLine[] = [
  { type: 'context', content: "import { useState } from 'react';", lineNum: 1 },
  { type: 'context', content: '', lineNum: 2 },
  { type: 'remove', content: '  const [count, setCount] = useState(0);', lineNum: 4 },
  { type: 'add', content: '  const [count, setCount] = useState<number>(0);', lineNum: 4 },
  { type: 'add', content: '  const [step, setStep] = useState(1);', lineNum: 5 },
  { type: 'context', content: '', lineNum: 6 },
  { type: 'remove', content: '      <h1 className="text-2xl font-bold">Counter: {count}</h1>', lineNum: 9 },
  { type: 'add', content: '      <h1 className="text-3xl font-bold text-primary">Counter: {count}</h1>', lineNum: 9 },
];

const langColors: Record<string, string> = {
  tsx: 'text-blue-400', ts: 'text-blue-300', css: 'text-purple-400',
  py: 'text-yellow-400', json: 'text-green-400', txt: 'text-[hsl(0,0%,53%)]',
};

// ─── Helpers ─────────────────────────────────────────────────────────
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
  if (mins < 1) return 'à l\'instant';
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
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

        {/* Add repo */}
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

        {/* Repos list */}
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

// ─── Main Component ──────────────────────────────────────────────────
const CodePage = () => {
  const model = useStore((s) => s.model);
  const isMobile = useIsMobile();

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
  const [leftTab, setLeftTab] = useState<'files' | 'github'>('files');
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

  // Terminal state
  const [termLines, setTermLines] = useState<TerminalLine[]>([
    { id: '0', type: 'system', content: '# AgentOS Terminal v1.0' },
    { id: '1', type: 'system', content: '# Tapez une commande ou laissez l\'IA exécuter pour vous.' },
  ]);
  const [termInput, setTermInput] = useState('');
  const [termExpanded, setTermExpanded] = useState(false);
  const termBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isStreaming]);
  useEffect(() => { termBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [termLines]);

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

  // ─── Handlers ────────────────────────────────────────────
  const sendToChat = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: ChatMsg = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    let fullContent = '';
    chatDirect(
      [
        { role: 'system', content: 'Tu es un assistant de programmation expert. Réponds en français. Fournis du code dans des blocs ```language quand approprié.' },
        ...messages.filter(m => m.role !== 'assistant' || m.content).map(m => ({ role: m.role, content: m.content })),
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
    );
  }, [messages, model, isStreaming]);

  const handleMainSubmit = () => { if (!input.trim()) return; setShowChat(true); sendToChat(input); setInput(''); };
  const handleChatSubmit = () => { if (!chatInput.trim()) return; sendToChat(chatInput); setChatInput(''); };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTermCommand = () => {
    if (!termInput.trim()) return;
    const cmd = termInput.trim();
    const newLines: TerminalLine[] = [{ id: Date.now().toString(), type: 'input', content: `$ ${cmd}` }];
    if (cmd === 'ls') {
      newLines.push({ id: `${Date.now()}-1`, type: 'output', content: 'src/  backend/  node_modules/  package.json  tsconfig.json  vite.config.ts' });
    } else if (cmd === 'pwd') {
      newLines.push({ id: `${Date.now()}-1`, type: 'output', content: '/home/user/agentos' });
    } else if (cmd.startsWith('git ')) {
      newLines.push({ id: `${Date.now()}-1`, type: 'output', content: `On branch ${activeRepoState?.branch || 'main'}\nYour branch is up to date with 'origin/${activeRepoState?.branch || 'main'}'.` });
    } else if (cmd === 'clear') {
      setTermLines([]); setTermInput(''); return;
    } else if (cmd.startsWith('npm ') || cmd.startsWith('yarn ') || cmd.startsWith('pnpm ')) {
      newLines.push({ id: `${Date.now()}-1`, type: 'output', content: `Running "${cmd}"...` });
      newLines.push({ id: `${Date.now()}-2`, type: 'output', content: '✓ Done in 1.2s' });
    } else {
      newLines.push({ id: `${Date.now()}-1`, type: 'error', content: `bash: ${cmd.split(' ')[0]}: commande simulée` });
    }
    setTermLines(prev => [...prev, ...newLines]);
    setTermInput('');
  };

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
    const content = sampleFileContents[path] || `// Fichier: ${path}\n// Contenu simulé`;
    setEditableContent(content);
    if (!pendingDiff) setPendingDiff(sampleDiff);
    if (isMobile) setShowLeftPanel(false);
  };

  const currentLanguage = selectedFile
    ? (selectedFile.split('.').pop() || 'txt')
    : 'txt';

  const fileContent = editableContent ?? (selectedFile ? (sampleFileContents[selectedFile] || `// Fichier: ${selectedFile}\n// Contenu simulé`) : null);

  // ─── Left panel content (shared between desktop sidebar & mobile sheet) ───
  const leftPanelContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b border-[hsl(0,0%,17%)]">
        <button onClick={() => setLeftTab('files')}
          className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${leftTab === 'files' ? 'text-foreground bg-[hsl(0,0%,15%)]' : 'text-muted-foreground hover:text-foreground'}`}>
          <Files size={12} className="inline mr-1.5" />Fichiers
        </button>
        <button onClick={() => setLeftTab('github')}
          className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${leftTab === 'github' ? 'text-foreground bg-[hsl(0,0%,15%)]' : 'text-muted-foreground hover:text-foreground'}`}>
          <GitFork size={12} className="inline mr-1.5" />GitHub
        </button>
      </div>

      {leftTab === 'files' ? (
        <div className="flex-1 overflow-y-auto py-1">
          <div className="px-2 py-1.5">
            <div className="flex items-center gap-1.5 rounded-lg bg-[hsl(0,0%,15%)] px-2.5 py-1.5">
              <Search size={12} className="text-muted-foreground" />
              <input placeholder="Rechercher..." className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground" />
            </div>
          </div>
          {defaultTree.map((node) => (
            <FileTreeNode key={node.name} node={node} depth={0} path=""
              selectedFile={selectedFile || undefined} onFileSelect={handleFileSelect} />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(0,0%,17%)]">
            <span className="text-xs font-medium text-foreground">Repositories</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowRepoModal(true)} className="text-muted-foreground hover:text-foreground p-1"><Plus size={14} /></button>
              <button className="text-muted-foreground hover:text-foreground p-1"><RefreshCw size={13} /></button>
            </div>
          </div>
          {repos.length === 0 ? (
            <div className="px-4 py-6 text-center text-muted-foreground text-xs">
              <p>Aucun repo connecté</p>
              <button onClick={() => setShowRepoModal(true)} className="mt-2 text-[hsl(14,74%,52%)] underline text-xs">Ajouter un repository</button>
            </div>
          ) : (
            repos.map((repo) => (
              <button key={repo.id} onClick={() => setActiveRepoId(repo.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-[hsl(0,0%,14%)] transition-colors ${
                  activeRepoState?.id === repo.id ? 'bg-[hsl(0,0%,15%)]' : 'hover:bg-[hsl(0,0%,13%)]'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <GitFork size={13} className="text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{repo.fullName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <GitBranch size={10} className="text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{repo.branch}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(repo.lastSync)}</span>
                </div>
              </button>
            ))
          )}
          <div className="border-t border-[hsl(0,0%,17%)] px-3 py-2 space-y-1">
            <button className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)] rounded-md">
              <GitPullRequest size={13} />Créer une Pull Request
            </button>
            <button onClick={() => activeRepoState && window.open(activeRepoState.url, '_blank')}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,15%)] rounded-md">
              <ExternalLink size={13} />Ouvrir sur GitHub
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Chat panel content ───────────────────────────────────
  const chatPanelContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(0,0%,17%)] flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <MessageSquare size={13} className="text-[hsl(14,74%,52%)]" />
          <span className="text-xs font-medium text-foreground">Chat de code</span>
        </div>
        <button onClick={() => setShowChat(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex-shrink-0 h-6 w-6 rounded-md flex items-center justify-center ${
              msg.role === 'user' ? 'bg-[hsl(14,74%,52%)]/20' : 'bg-[hsl(0,0%,20%)]'
            }`}>
              {msg.role === 'user' ? <User size={12} className="text-[hsl(14,74%,52%)]" /> : <Bot size={12} className="text-muted-foreground" />}
            </div>
            <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'text-right' : ''}`}>
              <p className="text-[13px] text-foreground/85 whitespace-pre-wrap leading-relaxed">{msg.content.replace(/```[\s\S]*?```/g, '').trim() || msg.content}</p>
              {msg.codeBlocks?.map((block, i) => (
                <div key={i} className="mt-2 rounded-lg border border-[hsl(0,0%,20%)] bg-[hsl(0,0%,10%)] overflow-hidden text-left">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[hsl(0,0%,15%)] border-b border-[hsl(0,0%,20%)]">
                    <span className="text-[10px] text-muted-foreground font-mono">{block.file || block.language}</span>
                    <button onClick={() => handleCopy(block.code, `${msg.id}-${i}`)} className="text-muted-foreground hover:text-foreground">
                      {copiedId === `${msg.id}-${i}` ? <Check size={12} className="text-[hsl(142,71%,45%)]" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <pre className="p-3 text-[11px] font-mono text-foreground/80 overflow-x-auto"><code>{block.code}</code></pre>
                </div>
              ))}
            </div>
          </div>
        ))}
        {isStreaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex gap-2">
            <div className="h-6 w-6 rounded-md bg-[hsl(0,0%,20%)] flex items-center justify-center">
              <Bot size={12} className="text-muted-foreground animate-pulse" />
            </div>
            <div className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[hsl(0,0%,15%)]">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>
      <div className="flex-shrink-0 p-3 border-t border-[hsl(0,0%,17%)]">
        <div className="flex items-center gap-2 rounded-lg border border-[hsl(0,0%,20%)] bg-[hsl(0,0%,15%)] px-3 py-2">
          <button className="text-muted-foreground hover:text-foreground flex-shrink-0"><Paperclip size={14} /></button>
          <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSubmit()}
            placeholder="Décrivez le code..."
            className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground min-w-0" />
          <button onClick={handleChatSubmit} disabled={!chatInput.trim() || isStreaming}
            className="text-[hsl(14,74%,52%)] hover:text-[hsl(14,74%,42%)] disabled:text-muted-foreground flex-shrink-0"><Send size={14} /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[hsl(0,0%,10%)]">
      <TaskSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Main content area */}
        <div className="flex-1 flex min-h-0">
          {/* Desktop left panel */}
          {!isMobile && showLeftPanel && (
            <div className="w-[240px] flex-shrink-0 border-r border-[hsl(0,0%,17%)] bg-[hsl(0,0%,11%)]">
              {leftPanelContent}
            </div>
          )}

          {/* Mobile left panel (Sheet) */}
          {isMobile && (
            <Sheet open={showLeftPanel} onOpenChange={setShowLeftPanel}>
              <SheetContent side="left" className="w-[280px] p-0 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,17%)]">
                <SheetTitle className="sr-only">Panneau fichiers</SheetTitle>
                {leftPanelContent}
              </SheetContent>
            </Sheet>
          )}

          {/* Center: Editor or empty */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedFile && fileContent ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Editor tab bar */}
                <div className="flex items-center justify-between border-b border-[hsl(0,0%,17%)] bg-[hsl(0,0%,11%)] px-2 flex-shrink-0">
                  <div className="flex items-center min-w-0">
                    <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-foreground bg-[hsl(0,0%,10%)] border-b-2 border-[hsl(14,74%,52%)]">
                      <span className="truncate max-w-[120px] sm:max-w-[200px]">{selectedFile.split('/').pop()}</span>
                      <button onClick={() => { setSelectedFile(null); setEditableContent(null); }} className="text-muted-foreground hover:text-foreground ml-1"><X size={11} /></button>
                    </div>
                  </div>
                  {/* View mode tabs */}
                  <div className="flex items-center gap-0.5 pr-1">
                    <button onClick={() => setViewMode('code')}
                      title="Code" className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors ${viewMode === 'code' ? 'bg-[hsl(14,74%,52%)]/15 text-[hsl(14,74%,52%)]' : 'text-muted-foreground hover:text-foreground'}`}>
                      <Code2 size={11} /><span className="hidden sm:inline">Code</span>
                    </button>
                    <button onClick={() => setViewMode('diff')}
                      title="Diff" className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors ${viewMode === 'diff' ? 'bg-[hsl(14,74%,52%)]/15 text-[hsl(14,74%,52%)]' : 'text-muted-foreground hover:text-foreground'}`}>
                      <GitBranch size={11} /><span className="hidden sm:inline">Diff</span>
                    </button>
                    <button onClick={() => setViewMode('split')}
                      title="Split" className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors ${viewMode === 'split' ? 'bg-[hsl(14,74%,52%)]/15 text-[hsl(14,74%,52%)]' : 'text-muted-foreground hover:text-foreground'}`}>
                      <SplitSquareHorizontal size={11} /><span className="hidden sm:inline">Split</span>
                    </button>
                    <button onClick={() => setViewMode('preview')}
                      title="Preview" className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-colors ${viewMode === 'preview' ? 'bg-[hsl(14,74%,52%)]/15 text-[hsl(14,74%,52%)]' : 'text-muted-foreground hover:text-foreground'}`}>
                      <Eye size={11} /><span className="hidden sm:inline">Preview</span>
                    </button>
                  </div>
                </div>

                {/* Editor + Preview area */}
                <div className={`flex-1 min-h-0 ${viewMode === 'split' ? 'flex' : 'flex flex-col'}`}>
                  {/* Editor pane — hidden in preview-only mode */}
                  {viewMode !== 'preview' && (
                    <div className={`flex flex-col min-h-0 ${viewMode === 'split' ? 'w-1/2 border-r border-[hsl(0,0%,17%)]' : 'flex-1'}`}>
                      <div className="flex-1 overflow-auto font-mono text-xs bg-[hsl(0,0%,10%)]">
                        {viewMode === 'code' || viewMode === 'split' ? (
                          <div className="relative h-full">
                            <textarea
                              value={fileContent}
                              onChange={(e) => setEditableContent(e.target.value)}
                              className="absolute inset-0 w-full h-full bg-transparent text-foreground/85 text-xs font-mono resize-none outline-none p-3 pl-12 leading-5 caret-white"
                              style={{ lineHeight: '20px', whiteSpace: 'pre', overflowWrap: 'normal' }}
                              spellCheck={false}
                            />
                            {/* Line numbers overlay */}
                            <div className="absolute left-0 top-0 p-3 pr-2 pointer-events-none select-none">
                              {fileContent.split('\n').map((_, i) => (
                                <div key={i} className="text-right text-[hsl(0,0%,27%)] leading-5 text-xs w-7">{i + 1}</div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          /* Diff view */
                          <div>
                            {!diffAccepted && pendingDiff && (
                              <div className="flex items-center justify-between px-3 py-2 bg-[hsl(14,74%,52%)]/10 border-b border-[hsl(0,0%,17%)] flex-wrap gap-2">
                                <span className="text-[11px] text-[hsl(14,74%,52%)] font-medium">Modifications proposées</span>
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => setDiffAccepted(true)} className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md bg-[hsl(142,71%,45%)]/20 text-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,45%)]/30">
                                    <Check size={11} /> Accepter
                                  </button>
                                  <button onClick={() => setPendingDiff(null)} className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30">
                                    <X size={11} /> Rejeter
                                  </button>
                                </div>
                              </div>
                            )}
                            <div className="p-3">
                              {(pendingDiff || sampleDiff).map((line, i) => (
                                <div key={i} className={`flex ${line.type === 'add' ? 'bg-[hsl(142,71%,45%)]/8' : line.type === 'remove' ? 'bg-destructive/8' : ''}`}>
                                  <span className="w-8 text-right pr-3 text-muted-foreground select-none shrink-0">{line.lineNum}</span>
                                  <span className={`w-4 text-center select-none shrink-0 ${line.type === 'add' ? 'text-[hsl(142,71%,45%)]' : line.type === 'remove' ? 'text-destructive' : 'text-[hsl(0,0%,20%)]'}`}>
                                    {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                                  </span>
                                  <span className={`whitespace-pre overflow-x-auto ${line.type === 'add' ? 'text-[hsl(142,71%,45%)]/90' : line.type === 'remove' ? 'text-destructive/70 line-through' : 'text-muted-foreground'}`}>
                                    {line.content}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Preview pane */}
                  {(viewMode === 'preview' || viewMode === 'split') && (
                    <div className={`flex flex-col min-h-0 ${viewMode === 'split' ? 'w-1/2' : 'flex-1'}`}>
                      <PreviewPanel
                        content={fileContent}
                        language={currentLanguage}
                        filePath={selectedFile || undefined}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-[hsl(0,0%,10%)]">
                <HexLogo size={isMobile ? 36 : 48} />
              </div>
            )}

            {/* Terminal panel */}
            {showTerminal && (
              <div className={`flex flex-col border-t border-[hsl(0,0%,17%)] bg-[hsl(0,0%,10%)] ${termExpanded ? 'h-80' : 'h-36 sm:h-44'}`}>
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-[hsl(0,0%,17%)] bg-[hsl(0,0%,11%)]">
                  <div className="flex items-center gap-2">
                    <TerminalIcon size={12} className="text-muted-foreground" />
                    <span className="text-[11px] font-medium text-muted-foreground">Terminal</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setTermExpanded(!termExpanded)} className="text-muted-foreground hover:text-foreground p-0.5">
                      {termExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                    </button>
                    <button onClick={() => setShowTerminal(false)} className="text-muted-foreground hover:text-foreground p-0.5"><X size={12} /></button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
                  {termLines.map((line) => (
                    <div key={line.id} className={`whitespace-pre-wrap break-all ${
                      line.type === 'error' ? 'text-destructive' : line.type === 'input' ? 'text-[hsl(14,74%,52%)]' : line.type === 'system' ? 'text-muted-foreground' : 'text-foreground/80'
                    }`}>{line.content}</div>
                  ))}
                  <div ref={termBottomRef} />
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-[hsl(0,0%,17%)]">
                  <span className="text-xs text-[hsl(14,74%,52%)] font-mono shrink-0">$</span>
                  <input value={termInput} onChange={(e) => setTermInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTermCommand()}
                    placeholder="Entrez une commande..."
                    className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground min-w-0" />
                </div>
              </div>
            )}
          </div>

          {/* Desktop chat panel */}
          {!isMobile && showChat && (
            <div className="w-[300px] xl:w-[340px] flex-shrink-0 border-l border-[hsl(0,0%,17%)] bg-[hsl(0,0%,11%)]">
              {chatPanelContent}
            </div>
          )}

          {/* Mobile chat panel (Sheet) */}
          {isMobile && (
            <Sheet open={showChat} onOpenChange={setShowChat}>
              <SheetContent side="right" className="w-full sm:w-[360px] p-0 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,17%)]">
                <SheetTitle className="sr-only">Chat de code</SheetTitle>
                {chatPanelContent}
              </SheetContent>
            </Sheet>
          )}
        </div>

        {/* Bottom section */}
        <div className="flex-shrink-0 bg-[hsl(0,0%,10%)] px-2 sm:px-3 pb-[calc(10px+env(safe-area-inset-bottom,0px))] pt-2">
          <div className="bg-[hsl(0,0%,15%)] border border-[hsl(0,0%,20%)] rounded-xl px-3 py-2.5 sm:py-3 mb-2">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMainSubmit()}
              placeholder="Nouvelle tâche..."
              className="w-full bg-transparent border-none outline-none text-muted-foreground text-[14px] sm:text-[15px] placeholder:text-[hsl(0,0%,33%)]" />
            <div className="flex items-center justify-between mt-2 gap-1">
              <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-hidden">
                <button className="flex items-center gap-1 bg-transparent border-none text-muted-foreground text-[11px] cursor-pointer px-1 py-1 rounded-md shrink-0">
                  <FolderOpen size={12} className="flex-shrink-0" />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis hidden sm:inline">Travailler dans un projet</span>
                  <ChevronDown size={11} className="flex-shrink-0" />
                </button>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <label className="flex items-center gap-1 cursor-pointer text-muted-foreground text-[11px] select-none"
                  onClick={() => setAutoAccept(!autoAccept)}>
                  <div className={`h-3.5 w-3.5 rounded-sm flex items-center justify-center flex-shrink-0 ${
                    autoAccept ? 'bg-[hsl(142,71%,45%)]' : 'border border-[hsl(0,0%,27%)] bg-transparent'
                  }`}>
                    {autoAccept && <Check size={9} className="text-white" />}
                  </div>
                  <span className="whitespace-nowrap hidden md:inline">Accepter auto.</span>
                </label>
                <div className="relative">
                  <button onClick={() => setShowCodeModelSelector(!showCodeModelSelector)}
                    className="flex items-center gap-1 bg-transparent border-none text-muted-foreground text-[12px] cursor-pointer px-1 py-1 rounded whitespace-nowrap hover:text-foreground transition-colors">
                    {getModelShortName()} <ChevronDown size={11} />
                  </button>
                  {showCodeModelSelector && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowCodeModelSelector(false)} />
                      <div className="absolute bottom-full right-0 mb-2 z-50">
                        <ModelSelector />
                      </div>
                    </>
                  )}
                </div>
                <button className="bg-transparent border-none text-muted-foreground cursor-pointer p-1 rounded-md flex items-center">
                  <Mic size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <button onClick={() => setShowLeftPanel(!showLeftPanel)}
              className="flex items-center gap-[5px] bg-[hsl(0,0%,15%)] border border-[hsl(0,0%,20%)] text-muted-foreground text-[11px] sm:text-xs py-[6px] sm:py-[7px] px-2 sm:px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap shrink-0">
              {showLeftPanel ? <PanelLeftClose size={12} /> : <PanelLeftOpen size={12} />}
              <span className="truncate max-w-[120px] sm:max-w-none">{activeRepoState?.fullName || 'Connecter un repo'}</span>
            </button>

            {activeRepoState ? (
              <button onClick={() => setShowBranchPicker(true)}
                className="flex items-center gap-[5px] bg-[hsl(0,0%,15%)] border border-[hsl(0,0%,20%)] text-muted-foreground text-[11px] sm:text-xs py-[6px] sm:py-[7px] px-2 sm:px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap shrink-0">
                <GitBranch size={12} />{activeRepoState.branch}
              </button>
            ) : (
              <button onClick={() => setShowRepoModal(true)}
                className="flex items-center gap-[5px] bg-[hsl(0,0%,15%)] border border-[hsl(0,0%,20%)] text-muted-foreground text-[11px] sm:text-xs py-[6px] sm:py-[7px] px-2 sm:px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap shrink-0">
                <GitBranch size={12} />Sélectionner une branche
              </button>
            )}

            <button className="flex items-center gap-[5px] bg-[hsl(142,47%,18%)] border border-[hsl(142,30%,24%)] text-[hsl(142,51%,60%)] text-[11px] sm:text-xs py-[6px] sm:py-[7px] px-2 sm:px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap shrink-0">
              <div className="w-[14px] h-[14px] bg-[hsl(142,71%,45%)] rounded-[3px] flex items-center justify-center flex-shrink-0">
                <Check size={9} className="text-white" />
              </div>
              worktree
            </button>

            <button onClick={() => setShowTerminal(!showTerminal)}
              className={`flex items-center gap-[5px] border text-[11px] sm:text-xs py-[6px] sm:py-[7px] px-2 sm:px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap shrink-0 ${
                showTerminal ? 'bg-[hsl(142,47%,18%)] border-[hsl(142,30%,24%)] text-[hsl(142,51%,60%)]' : 'bg-[hsl(0,0%,15%)] border-[hsl(0,0%,20%)] text-muted-foreground'
              }`}>
              {showTerminal ? <PanelBottomClose size={12} /> : <PanelBottomOpen size={12} />}
              Terminal
            </button>

            <button onClick={() => setShowChat(!showChat)}
              className={`flex items-center gap-[5px] border text-[11px] sm:text-xs py-[6px] sm:py-[7px] px-2 sm:px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap shrink-0 ${
                showChat ? 'bg-[hsl(14,74%,52%)]/20 border-[hsl(14,74%,52%)]/30 text-[hsl(14,74%,52%)]' : 'bg-[hsl(0,0%,15%)] border-[hsl(0,0%,20%)] text-muted-foreground'
              }`}>
              <MessageSquare size={12} />Chat
            </button>

            <button
              onClick={() => {
                if (!selectedFile) {
                  // Ouvrir un fichier HTML de démonstration
                  const demoPath = '/src/index.css';
                  handleFileSelect(demoPath);
                }
                setViewMode(v => v === 'split' ? 'code' : 'split');
              }}
              className={`flex items-center gap-[5px] border text-[11px] sm:text-xs py-[6px] sm:py-[7px] px-2 sm:px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap ml-auto shrink-0 transition-colors ${
                viewMode === 'split' || viewMode === 'preview'
                  ? 'bg-[hsl(14,74%,52%)]/20 border-[hsl(14,74%,52%)]/30 text-[hsl(14,74%,52%)]'
                  : 'bg-[hsl(0,0%,15%)] border-[hsl(0,0%,20%)] text-muted-foreground'
              }`}>
              <Monitor size={12} />Preview
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <RepoPickerModal open={showRepoModal} onClose={() => setShowRepoModal(false)} />
      {showBranchPicker && activeRepoState && (
        <BranchPicker repo={activeRepoState} onClose={() => setShowBranchPicker(false)} />
      )}
    </div>
  );
};

export default CodePage;
