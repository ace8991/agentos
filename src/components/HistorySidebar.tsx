import { Clock, Trash2, X } from 'lucide-react';
import { useStore, type HistoryRun } from '@/store/useStore';

const statusColor: Record<string, string> = {
  done: 'bg-success/20 text-success',
  error: 'bg-destructive/20 text-destructive',
  running: 'bg-primary/20 text-primary',
  idle: 'bg-muted text-muted-foreground',
};

const HistorySidebar = () => {
  const open = useStore((s) => s.historyOpen);
  const setOpen = useStore((s) => s.setHistoryOpen);
  const history = useStore((s) => s.history);
  const setViewing = useStore((s) => s.setViewingHistory);
  const deleteHistoryRun = useStore((s) => s.deleteHistoryRun);

  if (!open) return null;

  const handleClick = (run: HistoryRun) => {
    setViewing(run);
    setOpen(false);
  };

  return (
    <div className="absolute inset-0 z-40 bg-card border-l border-border flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2 text-foreground">
          <Clock size={16} />
          <span className="font-medium text-sm">Run History</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        {history.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No past runs</p>
        )}
        {history.map((run) => (
          <div
            key={run.run_id}
            className="group flex items-start gap-2 rounded-lg p-3 hover:bg-surface-elevated transition-colors"
          >
            <button
              onClick={() => handleClick(run)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="text-sm text-foreground truncate">{run.task.slice(0, 60)}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(run.date).toLocaleDateString()}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{run.steps} steps</span>
                <span className={`rounded-pill px-1.5 py-0.5 text-xs ${statusColor[run.status]}`}>
                  {run.status}
                </span>
              </div>
            </button>
            <button
              onClick={() => deleteHistoryRun(run.run_id)}
              className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-background hover:text-foreground group-hover:opacity-100"
              title="Delete conversation"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistorySidebar;
