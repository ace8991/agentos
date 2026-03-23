import { useState } from 'react';
import { Monitor, Terminal, Globe, Maximize2, Minimize2, Hand, ExternalLink } from 'lucide-react';
import { useStore } from '@/store/useStore';
import ActionAnnotationOverlay from './ActionAnnotationOverlay';
import StepProgressBar from './StepProgressBar';

type Tab = 'browser' | 'terminal';

interface ExecutionScreenProps {
  forceMobile?: boolean;
}

const ExecutionScreen = ({ forceMobile }: ExecutionScreenProps) => {
  const status = useStore((s) => s.status);
  const currentScreenshot = useStore((s) => s.currentScreenshot);
  const annotations = useStore((s) => s.annotations);
  const entries = useStore((s) => s.entries);
  const currentStep = useStore((s) => s.currentStep);
  const maxSteps = useStore((s) => s.maxSteps);
  const elapsedTime = useStore((s) => s.elapsedTime);
  const takeoverRequested = useStore((s) => s.takeoverRequested);
  const releaseTakeover = useStore((s) => s.releaseTakeover);
  const [activeTab, setActiveTab] = useState<Tab>('browser');
  const [expanded, setExpanded] = useState(false);

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const hasScreenshot = !!currentScreenshot;
  const terminalEntries = entries.filter((e) => e.type === 'shell');

  const latestEntry = entries[0];
  const currentAction = latestEntry?.toolLabel || (isRunning ? 'Processing...' : '');

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (!forceMobile && !hasScreenshot && !isRunning && !isPaused && entries.length === 0) {
    return null;
  }

  const containerClass = forceMobile
    ? 'flex-1 flex flex-col min-h-0 bg-card'
    : `${expanded ? 'w-[55%]' : 'w-[400px]'} shrink-0 h-screen bg-card border-l border-border flex flex-col transition-all duration-300`;

  return (
    <div className={containerClass}>
      <StepProgressBar />

      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('browser')}
            className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'browser' ? 'bg-surface-elevated text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe size={13} />
            Browser
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'terminal' ? 'bg-surface-elevated text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Terminal size={13} />
            Terminal
          </button>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {(isRunning || isPaused) && (
            <span className="text-xs text-muted-foreground tabular-nums">{formatTime(elapsedTime)}</span>
          )}
          {!forceMobile && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-surface-elevated active:scale-95"
            >
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Current action label */}
      {currentAction && (isRunning || isPaused) && (
        <div className="px-3 md:px-4 py-2 border-b border-border flex items-center gap-2">
          {isRunning && (
            <div className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full bg-primary"
                  style={{ animation: `pulse-dot 1.2s ease-in-out ${i * 0.15}s infinite` }}
                />
              ))}
            </div>
          )}
          {isPaused && <Hand size={12} className="text-accent" />}
          <span className="text-xs text-muted-foreground truncate">{currentAction}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        {activeTab === 'browser' ? (
          <div className="w-full h-full relative flex items-center justify-center bg-muted">
            {currentScreenshot ? (
              <>
                <img
                  src={`data:image/png;base64,${currentScreenshot}`}
                  alt="Agent browser view"
                  className="w-full h-full object-contain"
                />
                <ActionAnnotationOverlay annotations={annotations} />

                {takeoverRequested && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10 p-4">
                    <div className="bg-card border border-accent/30 rounded-xl p-5 md:p-6 max-w-xs text-center shadow-lg w-full">
                      <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mx-auto mb-3">
                        <Hand size={20} className="text-accent" />
                      </div>
                      <h3 className="text-sm font-medium text-foreground mb-1">Your turn</h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        Complete the required action in the browser, then click below.
                      </p>
                      <button
                        onClick={releaseTakeover}
                        className="w-full text-xs bg-accent text-accent-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity active:scale-[0.97] font-medium"
                      >
                        Done, resume agent
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Monitor size={28} strokeWidth={1.5} />
                <span className="text-xs">Waiting for browser capture...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full overflow-y-auto scrollbar-thin p-3 md:p-4 font-mono text-xs space-y-1 bg-[hsl(240_33%_3%)]">
            {terminalEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <Terminal size={24} strokeWidth={1.5} />
                <span className="text-xs">No terminal output yet</span>
              </div>
            ) : (
              [...terminalEntries].reverse().map((entry) => (
                <div key={entry.id} className="log-entry-enter">
                  <span className="text-secondary">$ </span>
                  <span className="text-foreground break-all">{entry.action}</span>
                  {entry.tool_result && (
                    <pre className="text-muted-foreground mt-0.5 whitespace-pre-wrap break-all">
                      {JSON.stringify(entry.tool_result, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2 border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {isRunning && (
            <>
              <div className="status-dot bg-primary status-dot-running" />
              <span>Step {currentStep}/{maxSteps}</span>
            </>
          )}
          {isPaused && (
            <>
              <div className="status-dot bg-accent" />
              <span>Paused</span>
            </>
          )}
          {status === 'done' && <span className="text-success">✓ Completed</span>}
          {status === 'error' && <span className="text-destructive">✗ Error</span>}
          {status === 'idle' && <span>Ready</span>}
        </div>
        <span className="tabular-nums">{formatTime(elapsedTime)}</span>
      </div>
    </div>
  );
};

export default ExecutionScreen;
