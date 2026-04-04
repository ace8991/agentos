import { useState } from 'react';
import { GitBranch, GitFork, FolderOpen, Check, ChevronDown, Mic, Monitor, PanelLeftClose, PanelRightClose, MessageSquare, FileCode, TerminalSquare } from 'lucide-react';
import TaskSidebar from '@/components/TaskSidebar';
import CodeChat from '@/components/code/CodeChat';
import FileExplorer from '@/components/code/FileExplorer';
import CodeEditor from '@/components/code/CodeEditor';
import Terminal from '@/components/code/Terminal';
import GitHubPanel from '@/components/code/GitHubPanel';

type LeftPanel = 'files' | 'chat' | 'github';

const CodePage = () => {
  const [autoAccept, setAutoAccept] = useState(true);
  const [selectedRepo] = useState('Alexis863/eduayiti');
  const [selectedBranch] = useState('main');
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [leftPanel, setLeftPanel] = useState<LeftPanel>('chat');
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);

  const panelTabs: { key: LeftPanel; icon: typeof MessageSquare; label: string }[] = [
    { key: 'chat', icon: MessageSquare, label: 'Chat' },
    { key: 'files', icon: FileCode, label: 'Fichiers' },
    { key: 'github', icon: GitFork, label: 'GitHub' },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <TaskSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top toolbar */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-[hsl(var(--surface))] flex-shrink-0">
          <div className="flex items-center gap-1">
            {panelTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setLeftPanel(tab.key); setShowLeftPanel(true); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                  leftPanel === tab.key && showLeftPanel ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                <tab.icon size={13} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                showTerminal ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TerminalSquare size={13} />
              <span className="hidden sm:inline">Terminal</span>
            </button>
            <button
              onClick={() => setShowLeftPanel(!showLeftPanel)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md"
            >
              {showLeftPanel ? <PanelLeftClose size={14} /> : <PanelRightClose size={14} />}
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex min-h-0">
          {/* Left panel */}
          {showLeftPanel && (
            <div className="w-72 flex-shrink-0 border-r border-border bg-[hsl(var(--surface))] flex flex-col min-h-0 max-w-[45vw]">
              {leftPanel === 'chat' && <CodeChat />}
              {leftPanel === 'files' && <FileExplorer onFileSelect={setSelectedFile} selectedFile={selectedFile} />}
              {leftPanel === 'github' && <GitHubPanel />}
            </div>
          )}

          {/* Right: editor + terminal */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="flex-1 min-h-0">
              <CodeEditor filePath={selectedFile} />
            </div>
            {showTerminal && <Terminal />}
          </div>
        </div>

        {/* Bottom toolbar */}
        <div className="flex-shrink-0 px-3 py-2 border-t border-border bg-[hsl(var(--surface))]">
          <div className="flex items-center gap-2 flex-wrap">
            <button className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <FolderOpen size={13} />
              {selectedRepo}
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <GitBranch size={12} />
              {selectedBranch}
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-2.5 py-1.5 text-xs text-success transition-colors">
              <div className="h-3.5 w-3.5 rounded-sm bg-success flex items-center justify-center">
                <Check size={9} className="text-background" />
              </div>
              worktree
            </button>
            <div className="flex-1" />
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground select-none">
              <div
                className={`h-4 w-4 rounded flex items-center justify-center transition-colors ${
                  autoAccept ? 'bg-primary text-primary-foreground' : 'border border-border bg-transparent'
                }`}
                onClick={() => setAutoAccept(!autoAccept)}
              >
                {autoAccept && <Check size={10} />}
              </div>
              <span className="hidden sm:inline" onClick={() => setAutoAccept(!autoAccept)}>Auto-accept</span>
            </label>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              Opus 4.6 <ChevronDown size={12} />
            </button>
            <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/30">
              <Mic size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodePage;
