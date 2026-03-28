import { useEffect, useMemo, useState } from 'react';
import { Globe, Hand, Maximize2, Minimize2, Monitor, Terminal, Wifi } from 'lucide-react';
import { useStore } from '@/store/useStore';
import ActionAnnotationOverlay from './ActionAnnotationOverlay';
import LiveBrowserView from './LiveBrowserView';
import StepProgressBar from './StepProgressBar';

type Tab = 'live' | 'browser' | 'terminal';

interface ExecutionScreenProps {
  forceMobile?: boolean;
}

const ExecutionScreen = ({ forceMobile }: ExecutionScreenProps) => {
  const status = useStore((s) => s.status);
  const currentScreenshot = useStore((s) => s.currentScreenshot);
  const browserUrl = useStore((s) => s.browserUrl);
  const browserTitle = useStore((s) => s.browserTitle);
  const annotations = useStore((s) => s.annotations);
  const entries = useStore((s) => s.entries);
  const currentStep = useStore((s) => s.currentStep);
  const maxSteps = useStore((s) => s.maxSteps);
  const elapsedTime = useStore((s) => s.elapsedTime);
  const runId = useStore((s) => s.runId);
  const takeoverRequested = useStore((s) => s.takeoverRequested);
  const releaseTakeover = useStore((s) => s.releaseTakeover);
  const lastSurface = useStore((s) => s.lastSurface);
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [expanded, setExpanded] = useState(false);

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isLive = isRunning || isPaused;
  const browserEntries = useMemo(() => entries.filter((entry) => entry.type === 'browser'), [entries]);
  const terminalEntries = useMemo(() => entries.filter((entry) => entry.type === 'shell'), [entries]);
  const hasBrowserActivity = isLive && (browserEntries.length > 0 || !!browserUrl || !!browserTitle);
  const hasTerminalActivity = isLive && terminalEntries.length > 0;
  const visibleTabs = [
    hasBrowserActivity ? 'live' : null,
    hasBrowserActivity ? 'browser' : null,
    hasTerminalActivity ? 'terminal' : null,
  ].filter(Boolean) as Tab[];

  useEffect(() => {
    if (lastSurface === 'terminal' && hasTerminalActivity) {
      setActiveTab('terminal');
      return;
    }
    if (lastSurface === 'browser' && hasBrowserActivity) {
      setActiveTab('live');
      return;
    }
    if (!hasBrowserActivity && hasTerminalActivity) {
      setActiveTab('terminal');
      return;
    }
    if (hasBrowserActivity) {
      setActiveTab('live');
    }
  }, [hasBrowserActivity, hasTerminalActivity, lastSurface]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!hasBrowserActivity && !hasTerminalActivity) {
    return null;
  }

  const latestEntry = entries[0];
  const latestRelevantEntry = activeTab === 'terminal' ? terminalEntries[0] : browserEntries[0];
  const currentAction = latestRelevantEntry?.toolLabel || (isRunning ? 'Processing...' : '');

  const containerClass = forceMobile
    ? 'flex-1 flex flex-col min-h-0 bg-card'
    : `${expanded ? 'w-[55%]' : 'w-[400px]'} shrink-0 h-screen bg-card border-l border-border flex flex-col transition-all duration-300`;

  return (
    <div className={containerClass}>
      <StepProgressBar />

      <div className="flex items-center justify-between border-b border-border px-3 py-2.5 md:px-4">
        {visibleTabs.length > 1 ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'live'
                  ? 'border border-red-500/20 bg-red-500/10 text-red-400'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wifi size={13} className={isRunning ? 'animate-pulse' : undefined} />
              Live
            </button>
            <button
              onClick={() => setActiveTab('browser')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'browser' ? 'bg-surface-elevated text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe size={13} />
              Browser
            </button>
            <button
              onClick={() => setActiveTab('terminal')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'terminal' ? 'bg-surface-elevated text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Terminal size={13} />
              Terminal
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs text-foreground">
            {hasBrowserActivity ? <Globe size={13} /> : <Terminal size={13} />}
            {hasBrowserActivity ? 'Browser live' : 'Terminal live'}
          </div>
        )}
        <div className="flex items-center gap-2 md:gap-3">
          {isLive && <span className="text-xs tabular-nums text-muted-foreground">{formatTime(elapsedTime)}</span>}
          {!forceMobile && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground active:scale-95"
            >
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
        </div>
      </div>

      {currentAction && isLive && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:px-4">
          {isRunning ? (
            <div className="flex gap-0.5">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-1 w-1 rounded-full bg-primary"
                  style={{ animation: `pulse-dot 1.2s ease-in-out ${index * 0.15}s infinite` }}
                />
              ))}
            </div>
          ) : (
            <Hand size={12} className="text-accent" />
          )}
          <span className="truncate text-xs text-muted-foreground">{currentAction}</span>
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {activeTab === 'live' && hasBrowserActivity ? (
          <LiveBrowserView
            runId={runId}
            isRunning={isRunning || isPaused}
            currentReasoning={latestEntry?.reasoning || ''}
          />
        ) : activeTab === 'browser' && hasBrowserActivity ? (
          <div className="relative flex h-full w-full items-center justify-center bg-muted">
            {currentScreenshot ? (
              <>
                <img
                  src={`data:image/jpeg;base64,${currentScreenshot}`}
                  alt="Agent browser view"
                  className="h-full w-full object-contain"
                />
                <ActionAnnotationOverlay annotations={annotations} />

                {(browserTitle || browserUrl) && (
                  <div className="absolute left-3 top-3 right-3 rounded-xl border border-white/10 bg-background/70 px-3 py-2 backdrop-blur-md">
                    {browserTitle && <p className="truncate text-xs font-medium text-foreground">{browserTitle}</p>}
                    {browserUrl && <p className="truncate text-[11px] text-muted-foreground">{browserUrl}</p>}
                  </div>
                )}

                {takeoverRequested && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-xs rounded-xl border border-accent/30 bg-card p-5 text-center shadow-lg md:p-6">
                      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
                        <Hand size={20} className="text-accent" />
                      </div>
                      <h3 className="mb-1 text-sm font-medium text-foreground">Your turn</h3>
                      <p className="mb-4 text-xs text-muted-foreground">
                        Complete the required action in the browser, then click below.
                      </p>
                      <button
                        onClick={releaseTakeover}
                        className="w-full rounded-lg bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition-opacity hover:opacity-90 active:scale-[0.97]"
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
                <span className="text-xs">Waiting for live browser capture...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full w-full overflow-y-auto bg-[hsl(240_33%_3%)] p-3 font-mono text-xs md:p-4">
            {terminalEntries.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <Terminal size={24} strokeWidth={1.5} />
                <span className="text-xs">No terminal output yet</span>
              </div>
            ) : (
              [...terminalEntries].reverse().map((entry) => (
                <div key={entry.id} className="log-entry-enter mb-2 rounded-lg border border-white/6 bg-white/[0.02] p-2">
                  <span className="text-secondary">$ </span>
                  <span className="break-all text-foreground">{entry.action}</span>
                  {entry.tool_result && (
                    <pre className="mt-1 whitespace-pre-wrap break-all text-muted-foreground">
                      {JSON.stringify(entry.tool_result, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground md:px-4">
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
          {!isLive && <span>Standby</span>}
        </div>
        <span className="tabular-nums">{formatTime(elapsedTime)}</span>
      </div>
    </div>
  );
};

export default ExecutionScreen;
