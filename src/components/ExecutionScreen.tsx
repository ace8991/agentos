import { useState } from 'react';
import { Monitor, Terminal, Globe, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import ActionAnnotationOverlay from './ActionAnnotationOverlay';
import StepProgressBar from './StepProgressBar';

type Tab = 'browser' | 'terminal';

const ExecutionScreen = () => {
  const status = useStore((s) => s.status);
  const currentScreenshot = useStore((s) => s.currentScreenshot);
  const annotations = useStore((s) => s.annotations);
  const entries = useStore((s) => s.entries);
  const currentStep = useStore((s) => s.currentStep);
  const maxSteps = useStore((s) => s.maxSteps);
  const elapsedTime = useStore((s) => s.elapsedTime);
  const [activeTab, setActiveTab] = useState<Tab>('browser');
  const [expanded, setExpanded] = useState(false);

  const isRunning = status === 'running';
  const hasScreenshot = !!currentScreenshot;
  const terminalEntries = entries.filter((e) => e.type === 'shell');

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // If no activity, show placeholder
  if (!hasScreenshot && !isRunning && entries.length === 0) {
    return null;
  }

  return (
    <div className={`${expanded ? 'w-[55%]' : 'w-[400px]'} shrink-0 h-screen bg-card border-l border-border flex flex-col transition-all duration-300`}>
      <StepProgressBar />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('browser')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'browser' ? 'bg-surface-elevated text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe size={13} />
            Browser
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'terminal' ? 'bg-surface-elevated text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Terminal size={13} />
            Terminal
          </button>
        </div>
        <div className="flex items-center gap-3">
          {isRunning && (
            <span className="text-xs text-muted-foreground tabular-nums">{formatTime(elapsedTime)}</span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-surface-elevated active:scale-95"
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
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
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Monitor size={28} strokeWidth={1.5} />
                <span className="text-xs">Waiting for browser capture...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full overflow-y-auto scrollbar-thin p-4 font-mono text-xs space-y-1 bg-[hsl(240_33%_3%)]">
            {terminalEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <Terminal size={24} strokeWidth={1.5} />
                <span className="text-xs">No terminal output yet</span>
              </div>
            ) : (
              terminalEntries.map((entry) => (
                <div key={entry.id} className="log-entry-enter">
                  <span className="text-secondary">$ </span>
                  <span className="text-foreground">{entry.action}</span>
                  {entry.tool_result && (
                    <pre className="text-muted-foreground mt-0.5 whitespace-pre-wrap">
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
      <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {isRunning && (
            <>
              <div className="status-dot bg-primary status-dot-running" />
              <span>Step {currentStep}/{maxSteps}</span>
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
