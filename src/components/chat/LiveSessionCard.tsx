import { useEffect, useMemo, useState } from 'react';
import { Globe, Terminal, Link2, Hand } from 'lucide-react';
import { useStore } from '@/store/useStore';

type SurfaceTab = 'browser' | 'terminal';

const LiveSessionCard = () => {
  const status = useStore((s) => s.status);
  const entries = useStore((s) => s.entries);
  const currentScreenshot = useStore((s) => s.currentScreenshot);
  const browserUrl = useStore((s) => s.browserUrl);
  const browserTitle = useStore((s) => s.browserTitle);
  const lastSurface = useStore((s) => s.lastSurface);
  const takeoverRequested = useStore((s) => s.takeoverRequested);
  const [activeTab, setActiveTab] = useState<SurfaceTab>('browser');

  const isLive = status === 'running' || status === 'paused';
  const browserEntries = useMemo(() => entries.filter((entry) => entry.type === 'browser'), [entries]);
  const terminalEntries = useMemo(() => entries.filter((entry) => entry.type === 'shell').slice(0, 6), [entries]);
  const hasBrowserActivity = isLive && (browserEntries.length > 0 || !!browserUrl || !!browserTitle);
  const hasTerminalActivity = isLive && terminalEntries.length > 0;
  const visibleTabs = [
    hasBrowserActivity ? 'browser' : null,
    hasTerminalActivity ? 'terminal' : null,
  ].filter(Boolean) as SurfaceTab[];

  useEffect(() => {
    if (lastSurface === 'terminal' && hasTerminalActivity) {
      setActiveTab('terminal');
      return;
    }
    if (lastSurface === 'browser' && hasBrowserActivity) {
      setActiveTab('browser');
      return;
    }
    if (!hasBrowserActivity && hasTerminalActivity) {
      setActiveTab('terminal');
      return;
    }
    if (hasBrowserActivity) {
      setActiveTab('browser');
    }
  }, [hasBrowserActivity, hasTerminalActivity, lastSurface]);

  if (!hasBrowserActivity && !hasTerminalActivity) {
    return null;
  }

  const latestBrowserEntry = browserEntries[0];
  const host = browserUrl ? (() => {
    try {
      return new URL(browserUrl).host;
    } catch {
      return browserUrl;
    }
  })() : null;

  return (
    <div className="px-3 md:px-5 pt-3">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
          <div>
            <p className="text-xs font-medium text-foreground">Live session</p>
            <p className="text-[11px] text-muted-foreground">
              Watch the agent interact with the web and local tools in real time.
            </p>
          </div>
          {visibleTabs.length > 1 ? (
            <div className="flex items-center gap-1 rounded-full border border-border bg-muted/60 p-1">
              <TabButton
                active={activeTab === 'browser'}
                disabled={!hasBrowserActivity}
                icon={Globe}
                label="Browser"
                onClick={() => setActiveTab('browser')}
              />
              <TabButton
                active={activeTab === 'terminal'}
                disabled={!hasTerminalActivity}
                icon={Terminal}
                label="Terminal"
                onClick={() => setActiveTab('terminal')}
              />
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/70 px-3 py-1 text-[11px] text-muted-foreground">
              {hasBrowserActivity ? <Globe size={12} /> : <Terminal size={12} />}
              {hasBrowserActivity ? 'Browser live' : 'Terminal live'}
            </div>
          )}
        </div>

        {activeTab === 'browser' && hasBrowserActivity ? (
          <div className="p-3">
            <div className="overflow-hidden rounded-xl border border-border bg-muted">
              {currentScreenshot ? (
                <img
                  src={`data:image/jpeg;base64,${currentScreenshot}`}
                  alt="Live browser session"
                  className="h-[240px] w-full object-cover md:h-[300px]"
                />
              ) : (
                <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground md:h-[300px]">
                  Preparing live browser view...
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {browserTitle && (
                <span className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-foreground">
                  {browserTitle}
                </span>
              )}
              {host && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                  <Link2 size={11} />
                  {host}
                </span>
              )}
              {takeoverRequested && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] text-accent">
                  <Hand size={11} />
                  Waiting for you
                </span>
              )}
            </div>
            {latestBrowserEntry?.action && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {latestBrowserEntry.action}
              </p>
            )}
          </div>
        ) : null}

        {activeTab === 'terminal' && hasTerminalActivity ? (
          <div className="max-h-[280px] overflow-y-auto bg-[hsl(240_33%_3%)] p-3 font-mono text-xs">
            <div className="space-y-2">
              {terminalEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-white/6 bg-white/[0.02] p-2">
                  <div className="text-[11px] text-emerald-300">$ {entry.action}</div>
                  {entry.tool_result && (
                    <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] text-slate-300/90">
                      {JSON.stringify(entry.tool_result, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const TabButton = ({
  active,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: typeof Globe;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
      active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
    } disabled:cursor-default disabled:opacity-45`}
  >
    <Icon size={12} />
    {label}
  </button>
);

export default LiveSessionCard;
