import { useState, useRef, useEffect, useCallback } from 'react';
import { GitBranch, FolderOpen, Check, ChevronDown, Mic, Monitor, MessageSquare, Files, GitFork, Terminal as TerminalIcon, PanelLeftClose, PanelLeftOpen, PanelBottomClose, PanelBottomOpen, Send, Bot, User, Copy, Paperclip, X, Undo2, ChevronRight, Folder, File, Search, Plus, RefreshCw, ExternalLink, Clock, AlertCircle, GitPullRequest, Maximize2, Minimize2 } from 'lucide-react';
import TaskSidebar from '@/components/TaskSidebar';
import HexLogo from '@/components/HexLogo';
import { chatDirect } from '@/lib/api';
import { useStore } from '@/store/useStore';

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

interface Repo {
  name: string;
  owner: string;
  branch: string;
  lastSync: string;
  status: 'synced' | 'ahead' | 'behind';
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
  '/src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 10%;
  --foreground: 0 0% 90%;
}`,
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

const sampleRepos: Repo[] = [
  { name: 'eduayiti', owner: 'Alexis863', branch: 'main', lastSync: 'il y a 2 min', status: 'synced' },
  { name: 'agentos', owner: 'Alexis863', branch: 'dev', lastSync: 'il y a 1h', status: 'ahead' },
];

const langColors: Record<string, string> = {
  tsx: 'text-blue-400', ts: 'text-blue-300', css: 'text-purple-400',
  py: 'text-yellow-400', json: 'text-green-400', txt: 'text-[#888]',
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
          className="w-full flex items-center gap-1.5 py-1 px-2 text-xs text-[#888] hover:text-[#ccc] hover:bg-[#252525] rounded transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {open ? <FolderOpen size={13} className="text-[#e05a2b]/70" /> : <Folder size={13} className="text-[#e05a2b]/70" />}
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
        isSelected ? 'bg-[#333] text-[#e0e0e0]' : 'text-[#888] hover:text-[#ccc] hover:bg-[#252525]'
      }`}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}>
      <File size={12} className={langColors[node.language || ''] || 'text-[#888]'} />
      <span className="truncate">{node.name}</span>
    </button>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
const CodePage = () => {
  const model = useStore((s) => s.model);

  // Layout state
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [leftTab, setLeftTab] = useState<'files' | 'github'>('files');
  const [showTerminal, setShowTerminal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Input bar state
  const [autoAccept, setAutoAccept] = useState(true);
  const [input, setInput] = useState('');
  const [selectedRepo] = useState('Alexis863/eduayiti');
  const [selectedBranch] = useState('Sélectionner une branche');

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: '1', role: 'assistant', content: 'Bonjour ! Décrivez ce que vous souhaitez créer ou modifier.' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Editor state
  const [viewMode, setViewMode] = useState<'code' | 'diff'>('code');
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

  // GitHub state
  const [activeRepo, setActiveRepo] = useState(0);
  const [showNewRepo, setShowNewRepo] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState('');

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    termBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [termLines]);

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
      model,
      null,
      false,
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

  const handleMainSubmit = () => {
    if (!input.trim()) return;
    setShowChat(true);
    sendToChat(input);
    setInput('');
  };

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;
    sendToChat(chatInput);
    setChatInput('');
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTermCommand = () => {
    if (!termInput.trim()) return;
    const cmd = termInput.trim();
    const newLines: TerminalLine[] = [
      { id: Date.now().toString(), type: 'input', content: `$ ${cmd}` },
    ];
    if (cmd === 'ls') {
      newLines.push({ id: `${Date.now()}-1`, type: 'output', content: 'src/  backend/  node_modules/  package.json  tsconfig.json  vite.config.ts' });
    } else if (cmd === 'pwd') {
      newLines.push({ id: `${Date.now()}-1`, type: 'output', content: '/home/user/agentos' });
    } else if (cmd.startsWith('git ')) {
      newLines.push({ id: `${Date.now()}-1`, type: 'output', content: `On branch main\nYour branch is up to date with 'origin/main'.` });
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
    if (!pendingDiff) setPendingDiff(sampleDiff);
  };

  const fileContent = selectedFile ? (sampleFileContents[selectedFile] || `// Fichier: ${selectedFile}\n// Contenu simulé`) : null;

  const statusIcons = {
    synced: <Check size={12} className="text-[#4caf6e]" />,
    ahead: <Clock size={12} className="text-[#e05a2b]" />,
    behind: <AlertCircle size={12} className="text-red-400" />,
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#1a1a1a]">
      <TaskSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Main content area */}
        <div className="flex-1 flex min-h-0">
          {/* Left panel: Files / GitHub */}
          {showLeftPanel && (
            <div className="w-[240px] flex-shrink-0 border-r border-[#2a2a2a] bg-[#1c1c1c] flex flex-col">
              <div className="flex items-center border-b border-[#2a2a2a]">
                <button onClick={() => setLeftTab('files')}
                  className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${leftTab === 'files' ? 'text-[#e0e0e0] bg-[#252525]' : 'text-[#888] hover:text-[#ccc]'}`}>
                  <Files size={12} className="inline mr-1.5" />Fichiers
                </button>
                <button onClick={() => setLeftTab('github')}
                  className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${leftTab === 'github' ? 'text-[#e0e0e0] bg-[#252525]' : 'text-[#888] hover:text-[#ccc]'}`}>
                  <GitFork size={12} className="inline mr-1.5" />GitHub
                </button>
              </div>

              {leftTab === 'files' ? (
                <div className="flex-1 overflow-y-auto py-1">
                  <div className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5 rounded-md bg-[#252525] px-2 py-1">
                      <Search size={12} className="text-[#666]" />
                      <input placeholder="Rechercher..." className="flex-1 bg-transparent text-xs text-[#ccc] outline-none placeholder:text-[#555]" />
                    </div>
                  </div>
                  {defaultTree.map((node) => (
                    <FileTreeNode key={node.name} node={node} depth={0} path=""
                      selectedFile={selectedFile || undefined} onFileSelect={handleFileSelect} />
                  ))}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a2a]">
                    <span className="text-xs font-medium text-[#e0e0e0]">Repositories</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setShowNewRepo(!showNewRepo)} className="text-[#888] hover:text-[#ccc] p-0.5"><Plus size={14} /></button>
                      <button className="text-[#888] hover:text-[#ccc] p-0.5"><RefreshCw size={13} /></button>
                    </div>
                  </div>
                  {showNewRepo && (
                    <div className="px-3 py-2 border-b border-[#2a2a2a] bg-[#252525] space-y-2">
                      <input value={newRepoUrl} onChange={(e) => setNewRepoUrl(e.target.value)}
                        placeholder="https://github.com/user/repo"
                        className="w-full bg-[#1a1a1a] border border-[#333] rounded-md px-2.5 py-1.5 text-xs text-[#ccc] outline-none placeholder:text-[#555]" />
                      <div className="flex gap-1.5">
                        <button className="flex-1 px-2 py-1.5 text-[11px] rounded-md bg-[#e05a2b] text-white">Cloner</button>
                        <button onClick={() => setShowNewRepo(false)} className="px-2 py-1.5 text-[11px] rounded-md bg-[#333] text-[#888]">Annuler</button>
                      </div>
                    </div>
                  )}
                  {sampleRepos.map((repo, i) => (
                    <button key={repo.name} onClick={() => setActiveRepo(i)}
                      className={`w-full text-left px-3 py-2.5 border-b border-[#2a2a2a] transition-colors ${activeRepo === i ? 'bg-[#252525]' : 'hover:bg-[#222]'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <GitFork size={13} className="text-[#888] flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[#ccc] truncate">{repo.owner}/{repo.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <GitBranch size={10} className="text-[#666]" />
                              <span className="text-[10px] text-[#666]">{repo.branch}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-1">{statusIcons[repo.status]}<span className="text-[10px] text-[#888]">{repo.lastSync}</span></div>
                        </div>
                      </div>
                    </button>
                  ))}
                  <div className="border-t border-[#2a2a2a] px-3 py-2 space-y-1">
                    <button className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-[#888] hover:text-[#ccc] hover:bg-[#252525] rounded-md">
                      <GitPullRequest size={13} />Créer une Pull Request
                    </button>
                    <button className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-[#888] hover:text-[#ccc] hover:bg-[#252525] rounded-md">
                      <ExternalLink size={13} />Ouvrir sur GitHub
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Center: Editor or empty */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedFile && fileContent ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Editor tab bar */}
                <div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#1c1c1c] px-2">
                  <div className="flex items-center">
                    <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-[#e0e0e0] bg-[#1a1a1a] border-b-2 border-[#e05a2b]">
                      <span className="truncate max-w-[200px]">{selectedFile.split('/').pop()}</span>
                      <button onClick={() => setSelectedFile(null)} className="text-[#888] hover:text-[#ccc] ml-1"><X size={11} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 pr-2">
                    <button onClick={() => setViewMode('code')}
                      className={`px-2.5 py-1 text-[11px] rounded ${viewMode === 'code' ? 'bg-[#e05a2b]/15 text-[#e05a2b]' : 'text-[#888] hover:text-[#ccc]'}`}>
                      Code
                    </button>
                    <button onClick={() => setViewMode('diff')}
                      className={`px-2.5 py-1 text-[11px] rounded ${viewMode === 'diff' ? 'bg-[#e05a2b]/15 text-[#e05a2b]' : 'text-[#888] hover:text-[#ccc]'}`}>
                      Diff
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto font-mono text-xs bg-[#1a1a1a]">
                  {viewMode === 'code' ? (
                    <div className="p-3">
                      {fileContent.split('\n').map((line, i) => (
                        <div key={i} className="flex">
                          <span className="w-8 text-right pr-3 text-[#555] select-none">{i + 1}</span>
                          <span className="text-[#ccc] whitespace-pre">{line}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {!diffAccepted && pendingDiff && (
                        <div className="flex items-center justify-between px-3 py-2 bg-[#e05a2b]/10 border-b border-[#2a2a2a]">
                          <span className="text-[11px] text-[#e05a2b] font-medium">Modifications proposées par l'IA</span>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setDiffAccepted(true)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md bg-[#4caf6e]/20 text-[#4caf6e] hover:bg-[#4caf6e]/30">
                              <Check size={11} /> Accepter
                            </button>
                            <button onClick={() => setPendingDiff(null)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30">
                              <X size={11} /> Rejeter
                            </button>
                            <button className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md bg-[#333] text-[#888] hover:bg-[#3a3a3a]">
                              <Undo2 size={11} /> Annuler
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="p-3">
                        {(pendingDiff || sampleDiff).map((line, i) => (
                          <div key={i} className={`flex ${line.type === 'add' ? 'bg-[#4caf6e]/8' : line.type === 'remove' ? 'bg-red-500/8' : ''}`}>
                            <span className="w-8 text-right pr-3 text-[#555] select-none">{line.lineNum}</span>
                            <span className={`w-4 text-center select-none ${line.type === 'add' ? 'text-[#4caf6e]' : line.type === 'remove' ? 'text-red-400' : 'text-[#333]'}`}>
                              {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                            </span>
                            <span className={`whitespace-pre ${line.type === 'add' ? 'text-[#4caf6e]/90' : line.type === 'remove' ? 'text-red-400/70 line-through' : 'text-[#999]'}`}>
                              {line.content}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-[#1a1a1a]">
                <HexLogo size={48} />
              </div>
            )}

            {/* Terminal panel */}
            {showTerminal && (
              <div className={`flex flex-col border-t border-[#2a2a2a] bg-[#1a1a1a] ${termExpanded ? 'h-80' : 'h-44'}`}>
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2a2a2a] bg-[#1c1c1c]">
                  <div className="flex items-center gap-2">
                    <TerminalIcon size={12} className="text-[#888]" />
                    <span className="text-[11px] font-medium text-[#888]">Terminal</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setTermExpanded(!termExpanded)} className="text-[#888] hover:text-[#ccc] p-0.5">
                      {termExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                    </button>
                    <button onClick={() => setShowTerminal(false)} className="text-[#888] hover:text-[#ccc] p-0.5"><X size={12} /></button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
                  {termLines.map((line) => (
                    <div key={line.id} className={`whitespace-pre-wrap ${
                      line.type === 'error' ? 'text-red-400' : line.type === 'input' ? 'text-[#e05a2b]' : line.type === 'system' ? 'text-[#666]' : 'text-[#bbb]'
                    }`}>{line.content}</div>
                  ))}
                  <div ref={termBottomRef} />
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-[#2a2a2a]">
                  <span className="text-xs text-[#e05a2b] font-mono">$</span>
                  <input value={termInput} onChange={(e) => setTermInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTermCommand()}
                    placeholder="Entrez une commande..."
                    className="flex-1 bg-transparent text-xs font-mono text-[#ccc] outline-none placeholder:text-[#555]" />
                </div>
              </div>
            )}
          </div>

          {/* Right panel: Chat */}
          {showChat && (
            <div className="w-[320px] flex-shrink-0 border-l border-[#2a2a2a] bg-[#1c1c1c] flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a2a]">
                <div className="flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-[#e05a2b]" />
                  <span className="text-xs font-medium text-[#e0e0e0]">Chat de code</span>
                </div>
                <button onClick={() => setShowChat(false)} className="text-[#888] hover:text-[#ccc]"><X size={14} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex-shrink-0 h-6 w-6 rounded-md flex items-center justify-center ${
                      msg.role === 'user' ? 'bg-[#e05a2b]/20' : 'bg-[#333]'
                    }`}>
                      {msg.role === 'user' ? <User size={12} className="text-[#e05a2b]" /> : <Bot size={12} className="text-[#888]" />}
                    </div>
                    <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'text-right' : ''}`}>
                      <p className="text-[13px] text-[#ccc] whitespace-pre-wrap leading-relaxed">{msg.content.replace(/```[\s\S]*?```/g, '').trim() || msg.content}</p>
                      {msg.codeBlocks?.map((block, i) => (
                        <div key={i} className="mt-2 rounded-lg border border-[#333] bg-[#1a1a1a] overflow-hidden text-left">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-[#252525] border-b border-[#333]">
                            <span className="text-[10px] text-[#888] font-mono">{block.file || block.language}</span>
                            <button onClick={() => handleCopy(block.code, `${msg.id}-${i}`)} className="text-[#888] hover:text-[#ccc]">
                              {copiedId === `${msg.id}-${i}` ? <Check size={12} className="text-[#4caf6e]" /> : <Copy size={12} />}
                            </button>
                          </div>
                          <pre className="p-3 text-[11px] font-mono text-[#bbb] overflow-x-auto"><code>{block.code}</code></pre>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {isStreaming && messages[messages.length - 1]?.content === '' && (
                  <div className="flex gap-2">
                    <div className="h-6 w-6 rounded-md bg-[#333] flex items-center justify-center">
                      <Bot size={12} className="text-[#888] animate-pulse" />
                    </div>
                    <div className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#252525]">
                      <div className="h-1.5 w-1.5 rounded-full bg-[#888] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-[#888] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-[#888] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>
              <div className="flex-shrink-0 p-3 border-t border-[#2a2a2a]">
                <div className="flex items-center gap-2 rounded-lg border border-[#333] bg-[#252525] px-3 py-2">
                  <button className="text-[#888] hover:text-[#ccc]"><Paperclip size={14} /></button>
                  <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSubmit()}
                    placeholder="Décrivez le code..."
                    className="flex-1 bg-transparent text-[13px] text-[#ccc] outline-none placeholder:text-[#555]" />
                  <button onClick={handleChatSubmit} disabled={!chatInput.trim() || isStreaming}
                    className="text-[#e05a2b] hover:text-[#c04518] disabled:text-[#555]"><Send size={14} /></button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom section - same design as original */}
        <div className="flex-shrink-0 bg-[#1a1a1a] px-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))] pt-2.5">
          <div className="bg-[#252525] border border-[#333] rounded-xl px-3.5 py-3 mb-2.5">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMainSubmit()}
              placeholder="Nouvelle tâche..."
              className="w-full bg-transparent border-none outline-none text-[#888] text-[15px] placeholder:text-[#555]" />
            <div className="flex items-center justify-between mt-2.5 gap-1">
              <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                <button className="flex items-center gap-1 bg-transparent border-none text-[#666] text-[11.5px] cursor-pointer px-1.5 py-1 rounded-md">
                  <FolderOpen size={13} className="flex-shrink-0" />
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">Travailler dans un projet</span>
                  <ChevronDown size={12} className="flex-shrink-0" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <label className="flex items-center gap-1.5 cursor-pointer text-[#666] text-[11.5px] select-none"
                  onClick={() => setAutoAccept(!autoAccept)}>
                  <div className={`h-3.5 w-3.5 rounded-sm flex items-center justify-center flex-shrink-0 ${
                    autoAccept ? 'bg-[#4caf6e]' : 'border border-[#444] bg-transparent'
                  }`}>
                    {autoAccept && <Check size={9} className="text-white" />}
                  </div>
                  <span className="whitespace-nowrap hidden sm:inline">Accepter automatiquement les modifications</span>
                </label>
                <button className="flex items-center gap-1 bg-transparent border-none text-[#888] text-[12.5px] cursor-pointer px-1 py-1 rounded whitespace-nowrap">
                  Opus 4.6 <ChevronDown size={12} />
                </button>
                <button className="bg-transparent border-none text-[#666] cursor-pointer p-1.5 rounded-md flex items-center">
                  <Mic size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setShowLeftPanel(!showLeftPanel)}
              className="flex items-center gap-[5px] bg-[#252525] border border-[#333] text-[#888] text-xs py-[7px] px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap">
              {showLeftPanel ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
              {selectedRepo}
            </button>
            <button className="flex items-center gap-[5px] bg-[#252525] border border-[#333] text-[#777] text-xs py-[7px] px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap">
              <GitBranch size={12} />{selectedBranch}
            </button>
            <button className="flex items-center gap-[5px] bg-[#1e3a2a] border border-[#2a4a36] text-[#5cb87a] text-xs py-[7px] px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap">
              <div className="w-[15px] h-[15px] bg-[#4caf6e] rounded-[3px] flex items-center justify-center flex-shrink-0">
                <Check size={10} className="text-white" />
              </div>
              worktree
            </button>
            <button onClick={() => setShowTerminal(!showTerminal)}
              className={`flex items-center gap-[5px] border text-xs py-[7px] px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap ${
                showTerminal ? 'bg-[#1e3a2a] border-[#2a4a36] text-[#5cb87a]' : 'bg-[#252525] border-[#333] text-[#888]'
              }`}>
              {showTerminal ? <PanelBottomClose size={12} /> : <PanelBottomOpen size={12} />}
              Terminal
            </button>
            <button onClick={() => setShowChat(!showChat)}
              className={`flex items-center gap-[5px] border text-xs py-[7px] px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap ${
                showChat ? 'bg-[#e05a2b]/20 border-[#e05a2b]/30 text-[#e05a2b]' : 'bg-[#252525] border-[#333] text-[#888]'
              }`}>
              <MessageSquare size={12} />Chat
            </button>
            <button className="flex items-center gap-[5px] bg-[#252525] border border-[#333] text-[#888] text-xs py-[7px] px-2.5 rounded-[7px] cursor-pointer whitespace-nowrap ml-auto">
              <Monitor size={12} />Local
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodePage;
