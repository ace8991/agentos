import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Search, Settings, SlidersHorizontal, BookOpen, Bot, FolderPlus,
  Share2, ChevronRight, Plug, Globe, PanelLeftClose, PanelLeftOpen,
  BarChart3, Clock, Trash2
} from 'lucide-react';
import { useStore, type HistoryRun } from '@/store/useStore';
import HexLogo from './HexLogo';
import SidebarModeSwitch from './sidebar/SidebarModeSwitch';
import SidebarToolStatus from './sidebar/SidebarToolStatus';

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
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNewTask = () => {
    reset();
    navigate('/');
  };

  const handleTaskClick = (run: HistoryRun) => {
    setViewingHistory(run);
    navigate('/dashboard');
  };

  const handleClearHistory = () => {
    useStore.setState({ history: [] });
  };

  const filteredHistory = history
    .filter((r) => !searchQuery || r.task.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((r) => !filterStatus || r.status === filterStatus);

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
        <button onClick={() => { setCollapsed(false); setAgentsOpen(true); }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Agents">
          <Bot size={16} />
        </button>
        <button onClick={() => { setCollapsed(false); setSearchOpen(true); }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Search">
          <Search size={16} />
        </button>
        <button onClick={() => { setCollapsed(false); setLibraryOpen(true); }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Library">
          <BookOpen size={16} />
        </button>

        <div className="flex-1" />

        <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Settings">
          <Settings size={16} />
        </button>
        <button onClick={() => { setCollapsed(false); setSettingsOpen(true); }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Connectors">
          <Plug size={16} />
        </button>
        <button onClick={() => { setCollapsed(false); setSettingsOpen(true); }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Cloud browser">
          <Globe size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[260px] shrink-0 h-screen bg-card border-r border-border flex flex-col transition-all duration-300">
      {/* Logo header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
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

      {/* Mode switcher */}
      <SidebarModeSwitch />

      {/* Main navigation */}
      <div className="px-3 py-2 space-y-0.5">
        <button
          onClick={handleNewTask}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.98]"
        >
          <Plus size={16} className="text-muted-foreground" />
          <span>New task</span>
        </button>
        <button
          onClick={() => setAgentsOpen(!agentsOpen)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors active:scale-[0.98] ${agentsOpen ? 'bg-surface-elevated text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'}`}
        >
          <Bot size={16} />
          <span>Agents</span>
        </button>
        <button
          onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchQuery(''); }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors active:scale-[0.98] ${searchOpen ? 'bg-surface-elevated text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'}`}
        >
          <Search size={16} />
          <span>Search</span>
        </button>
        <button
          onClick={() => setLibraryOpen(!libraryOpen)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors active:scale-[0.98] ${libraryOpen ? 'bg-surface-elevated text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'}`}
        >
          <BookOpen size={16} />
          <span>Library</span>
        </button>
      </div>

      {/* Agents panel */}
      {agentsOpen && (
        <div className="px-3 pb-2 log-entry-enter">
          <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Agent Templates</p>
            {[
              { name: 'Web Researcher', desc: 'Searches & synthesizes web info' },
              { name: 'Code Assistant', desc: 'Writes & debugs code' },
              { name: 'Data Analyst', desc: 'Processes data & creates charts' },
            ].map((agent) => (
              <button
                key={agent.name}
                onClick={() => {
                  useStore.getState().setTask(`Act as a ${agent.name}: `);
                  setAgentsOpen(false);
                  navigate('/dashboard');
                }}
                className="w-full text-left px-2.5 py-2 rounded-md hover:bg-surface-elevated transition-colors"
              >
                <p className="text-xs font-medium text-foreground">{agent.name}</p>
                <p className="text-[11px] text-muted-foreground">{agent.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Library panel */}
      {libraryOpen && (
        <div className="px-3 pb-2 log-entry-enter">
          <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Saved Prompts</p>
            {history.length > 0 ? (
              history.slice(0, 5).map((run) => (
                <button
                  key={run.run_id}
                  onClick={() => {
                    useStore.getState().setTask(run.task);
                    setLibraryOpen(false);
                    navigate('/dashboard');
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-surface-elevated transition-colors"
                >
                  <p className="text-xs text-foreground truncate">{run.task}</p>
                </button>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">No saved prompts yet</p>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-border mx-3" />

      <div className="px-3 py-2">
        <button
          onClick={handleNewTask}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.98]"
        >
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
          <div className="flex items-center gap-1">
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                title="Clear history"
              >
                <Trash2 size={12} />
              </button>
            )}
            <button
              onClick={() => setFilterStatus(filterStatus ? null : 'done')}
              className={`transition-colors p-0.5 ${filterStatus ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              title="Filter tasks"
            >
              <SlidersHorizontal size={13} />
            </button>
          </div>
        </div>
        {filterStatus && (
          <div className="flex gap-1 px-3 mt-1.5">
            {['done', 'error', 'running'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                className={`text-[10px] px-2 py-0.5 rounded-full capitalize transition-colors ${
                  filterStatus === s ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
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
                  {new Date(run.date).toLocaleDateString()} · {run.steps} steps
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Tool status */}
      <SidebarToolStatus />

      {/* Referral */}
      <div className="mx-3 mb-2">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 transition-colors text-left active:scale-[0.98]">
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
          <button
            onClick={() => {
              setSettingsOpen(true);
              // Will open on connectors section
            }}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95"
            title="Connectors"
          >
            <Plug size={16} />
          </button>
          <button
            onClick={() => {
              setSettingsOpen(true);
            }}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95"
            title="Cloud browser"
          >
            <Globe size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskSidebar;
