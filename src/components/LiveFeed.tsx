import { Clock, Monitor, AlertTriangle } from 'lucide-react';
import { useStore, type AgentStatus } from '@/store/useStore';
import StepProgressBar from './StepProgressBar';
import ActionAnnotationOverlay from './ActionAnnotationOverlay';
import ActionLogEntry from './ActionLogEntry';
import HistorySidebar from './HistorySidebar';
import EmptyState from './EmptyState';

const statusStyles: Record<AgentStatus, { bg: string; dot: string; label: string }> = {
  idle: { bg: 'bg-muted', dot: 'bg-muted-foreground', label: 'Idle' },
  running: { bg: 'bg-primary/15', dot: 'bg-primary status-dot-running', label: 'Running' },
  paused: { bg: 'bg-accent/15', dot: 'bg-accent', label: 'Paused' },
  done: { bg: 'bg-success/15', dot: 'bg-success', label: 'Done' },
  error: { bg: 'bg-destructive/15', dot: 'bg-destructive', label: 'Error' },
};

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const LiveFeed = () => {
  const status = useStore((s) => s.status);
  const currentStep = useStore((s) => s.currentStep);
  const maxSteps = useStore((s) => s.maxSteps);
  const elapsedTime = useStore((s) => s.elapsedTime);
  const currentScreenshot = useStore((s) => s.currentScreenshot);
  const annotations = useStore((s) => s.annotations);
  const entries = useStore((s) => s.entries);
  const errorMessage = useStore((s) => s.errorMessage);
  const setHistoryOpen = useStore((s) => s.setHistoryOpen);
  const startAgent = useStore((s) => s.startAgent);

  const st = statusStyles[status];
  const hasActivity = entries.length > 0 || currentScreenshot;

  return (
    <div className="flex-1 h-screen flex flex-col relative overflow-hidden">
      <StepProgressBar />

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-4">
          {/* Status pill */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-pill ${st.bg}`}>
            <div className={`status-dot ${st.dot}`} />
            <span className="text-xs font-medium text-foreground">{st.label}</span>
          </div>
          {status !== 'idle' && (
            <>
              <span className="text-sm text-muted-foreground tabular-nums">
                Step {currentStep} / {maxSteps}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">{formatTime(elapsedTime)}</span>
            </>
          )}
        </div>
        <button
          onClick={() => setHistoryOpen(true)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-surface-elevated active:scale-95"
          title="Run History"
        >
          <Clock size={17} />
        </button>
      </div>

      {/* Error banner */}
      {status === 'error' && errorMessage && (
        <div className="mx-5 mt-3 flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-2.5 rounded-lg">
          <AlertTriangle size={15} className="shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button
            onClick={startAgent}
            className="text-xs bg-destructive text-destructive-foreground px-3 py-1 rounded-md hover:opacity-90 transition-opacity shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {!hasActivity && status === 'idle' ? (
        <EmptyState />
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Screenshot viewer — top 55% */}
          <div className="h-[55%] p-5 pb-2">
            <div
              className={`w-full h-full rounded-lg border overflow-hidden relative flex items-center justify-center ${
                status === 'running' ? 'border-secondary' : 'border-border'
              } ${!currentScreenshot ? 'border-dashed' : ''} bg-muted`}
            >
              {currentScreenshot ? (
                <>
                  <img
                    src={`data:image/jpeg;base64,${currentScreenshot}`}
                    alt="Agent screenshot"
                    className="w-full h-full object-contain"
                  />
                  <ActionAnnotationOverlay annotations={annotations} />
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Monitor size={32} strokeWidth={1.5} />
                  <span className="text-sm">Waiting for agent to capture screen...</span>
                </div>
              )}
            </div>
          </div>

          {/* Action log — bottom 45% */}
          <div className="h-[45%] flex flex-col border-t border-border">
            <div className="px-5 py-2 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Action Log</span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-3 space-y-2">
              {entries.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No actions yet</p>
              )}
              {entries.map((entry) => (
                <ActionLogEntry key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History sidebar overlay */}
      <HistorySidebar />
    </div>
  );
};

export default LiveFeed;
