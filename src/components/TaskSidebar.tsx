import { useState } from 'react';
import { Plus, Search, Settings, Calendar, Mail, Database, Globe, User, Puzzle, Plug, Layers, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore, type HistoryRun } from '@/store/useStore';
import HexLogo from './HexLogo';

const menuItems = [
  { icon: Plus, label: 'New task', action: 'new' },
  { icon: Search, label: 'Search', action: 'search' },
];

const settingsItems = [
  { icon: Calendar, label: 'Scheduled tasks', key: 'scheduled' },
  { icon: Mail, label: 'Mail', key: 'mail' },
  { icon: Database, label: 'Data controls', key: 'data' },
  { icon: Globe, label: 'Cloud browser', key: 'cloud-browser' },
  { icon: User, label: 'Personalization', key: 'personalization' },
  { icon: Puzzle, label: 'Skills', key: 'skills' },
  { icon: Plug, label: 'Connectors', key: 'connectors' },
  { icon: Layers, label: 'Integrations', key: 'integrations' },
];

const statusDot: Record<string, string> = {
  done: 'bg-success',
  error: 'bg-destructive',
  running: 'bg-primary status-dot-running',
  idle: 'bg-muted-foreground',
};

const TaskSidebar = () => {
  const history = useStore((s) => s.history);
  const setTask = useStore((s) => s.setTask);
  const reset = useStore((s) => s.reset);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setViewingHistory = useStore((s) => s.setViewingHistory);
  const [settingsSection, setSettingsSection] = useState<string | null>(null);

  const handleNewTask = () => {
    reset();
  };

  const handleTaskClick = (run: HistoryRun) => {
    setViewingHistory(run);
  };

  return (
    <div className="w-[260px] shrink-0 h-screen bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <HexLogo size={24} />
        <span className="text-foreground font-medium tracking-tight text-sm">AgentOS</span>
      </div>

      {/* Top actions */}
      <div className="px-3 py-2 space-y-0.5">
        <button
          onClick={handleNewTask}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.98]"
        >
          <Plus size={16} className="text-muted-foreground" />
          <span>New task</span>
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.98]"
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </div>

      {/* Task history */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center justify-between px-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">All tasks</span>
          <SlidersHorizontal size={13} className="text-muted-foreground" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-1 space-y-0.5">
        {history.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">No tasks yet</p>
        )}
        {history.map((run) => (
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

      {/* Bottom settings shortcuts */}
      <div className="border-t border-border px-3 py-2 space-y-0.5">
        {settingsItems.slice(0, 3).map((item) => (
          <button
            key={item.key}
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
          >
            <item.icon size={14} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TaskSidebar;
