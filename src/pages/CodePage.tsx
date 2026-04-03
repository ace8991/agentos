import { useState } from 'react';
import { GitBranch, GitFork, FolderOpen, Check, ChevronDown, Mic, Monitor } from 'lucide-react';
import TaskSidebar from '@/components/TaskSidebar';

const CodePage = () => {
  const [input, setInput] = useState('');
  const [autoAccept, setAutoAccept] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState('Alexis863/eduayiti');
  const [selectedBranch, setSelectedBranch] = useState('main');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // handle submit
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <TaskSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Main area - empty state */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="mx-auto h-16 w-16 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center">
              <Monitor size={28} className="text-white/40" />
            </div>
            <p className="text-sm text-white/50">Décrivez une tâche pour commencer à coder</p>
          </div>
        </div>

        {/* Bottom input area */}
        <div className="flex-shrink-0 px-3 pb-4 pt-2 sm:px-4">
          <div className="rounded-xl border border-white/10 bg-[hsl(var(--surface))] p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Décrivez une tâche de développement..."
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between mt-3 gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors select-none">
                  <div
                    className={`h-4 w-4 rounded flex items-center justify-center transition-colors ${
                      autoAccept ? 'bg-primary text-primary-foreground' : 'border border-white/20 bg-transparent'
                    }`}
                    onClick={() => setAutoAccept(!autoAccept)}
                  >
                    {autoAccept && <Check size={10} />}
                  </div>
                  <span className="whitespace-nowrap" onClick={() => setAutoAccept(!autoAccept)}>
                    Accepter automatiquement
                  </span>
                </label>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Opus 4.6
                  <ChevronDown size={12} />
                </button>
                <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-white/5">
                  <Mic size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[hsl(var(--surface))] px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <FolderOpen size={13} />
              {selectedRepo}
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[hsl(var(--surface))] px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <GitBranch size={12} />
              {selectedBranch}
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 px-2.5 py-1.5 text-xs text-[hsl(var(--success))] transition-colors">
              <div className="h-3.5 w-3.5 rounded-sm bg-[hsl(var(--success))] flex items-center justify-center">
                <Check size={9} className="text-background" />
              </div>
              worktree
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[hsl(var(--surface))] px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">
              <GitFork size={12} />
              Local
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodePage;
