import { useState } from 'react';
import {
  Plus, Search, Settings, SlidersHorizontal, BookOpen, Bot, FolderPlus,
  Share2, ChevronRight, Plug, Globe, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { useStore, type HistoryRun } from '@/store/useStore';
import HexLogo from './HexLogo';

const statusDot: Record<string, string> = {
  done: 'bg-success',
  error: 'bg-destructive',
  running: 'bg-primary status-dot-running',
  idle: 'bg-muted-foreground',
  paused: 'bg-accent',
};

const TaskSidebar = () => {
  const history = useStore((s) => s.history);
  const reset = useStore((s) => s.reset);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setViewingHistory = useStore((s) => s.setViewingHistory);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleNewTask = () => {
    reset();
  };

  const handleTaskClick = (run: HistoryRun) => {
    setViewingHistory(run);
  };

  const filteredHistory = searchQuery
    ? history.filter((r) => r.task.toLowerCase().includes(searchQuery.toLowerCase()))
    : history;

  // Collapsed mini sidebar
  if (collapsed) {
    return (
      <div className="w-14 shrink-0 h-screen bg-card border-r border-border flex flex-col items-center py-3 gap-1 transition-all duration-300">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95 mb-2"
          title="Expand sidebar"
        >
          <PanelLeftOpen size={18} />
        </button>
        <div className="w-6 h-6 flex items-center justify-center mb-2">
          <HexLogo size={20} />
        </div>
        <button onClick={handleNewTask} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="New task">
          <Plus size={16} />
        </button>
        <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Agents">
          <Bot size={16} />
        </button>
        <button onClick={() => { setCollapsed(false); setSearchOpen(true); }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Search">
          <Search size={16} />
        </button>
        <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Library">
          <BookOpen size={16} />
        </button>

        <div className="flex-1" />

        <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Settings">
          <Settings size={16} />
        </button>
        <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Connectors">
          <Plug size={16} />
        </button>
        <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Cloud browser">
          <Globe size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[260px] shrink-0 h-screen bg-card border-r border-border flex flex-col transition-all duration-300">
      {/* Logo header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <HexLogo size={24} />
          <span className="text-foreground font-medium tracking-tight text-sm">AgentOS</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-surface-elevated active:scale-95"
          title="Minimize sidebar"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      {/* Main navigation */}
      <div className="px-3 py-2 space-y-0.5">
        <button
          onClick={handleNewTask}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.98]"
        >
          <Plus size={16} className="text-muted-foreground" />
          <span>New task</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.98]">
          <Bot size={16} />
          <span>Agents</span>
        </button>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.98]"
        >
          <Search size={16} />
          <span>Search</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.98]">
          <BookOpen size={16} />
          <span>Library</span>
        </button>
      </div>

      <div className="border-t border-border mx-3" />

      <div className="px-3 py-2">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.98]">
          <FolderPlus size={16} />
          <span>New project</span>
        </button>
      </div>

      {searchOpen && (
        <div className="px-3 pb-2 log-entry-enter">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            autoFocus
            className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}

      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center justify-between px-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">All tasks</span>
          <SlidersHorizontal size={13} className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-1 space-y-0.5">
        {filteredHistory.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            {searchQuery ? 'No matching tasks' : 'No tasks yet'}
          </p>
        )}
        {filteredHistory.map((run) => (
          <button
            key={run.run_id}
            onClick={() => handleTaskClick(run)}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-elevated transition-colors group"
          >
            <div className="flex items-start gap-2.5">
              <div className={`status-dot mt-1.5 shrink-0 ${statusDot[run.status]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate leading-snug">{run.task}</p>
                <span className="text-xs text-muted-foreground mt-0.5 block">
                  {new Date(run.date).toLocaleDateString()}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mx-3 mb-2">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 transition-colors text-left">
          <Share2 size={16} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">Share AgentOS with a friend</p>
            <p className="text-xs text-muted-foreground">Get 500 credits each</p>
          </div>
          <ChevronRight size={14} className="text-muted-foreground shrink-0" />
        </button>
      </div>

      <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Settings">
            <Settings size={16} />
          </button>
          <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Connectors">
            <Plug size={16} />
          </button>
          <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Cloud browser">
            <Globe size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskSidebar;
