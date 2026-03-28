import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronUp, Globe, MonitorSmartphone, Radio, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const extractHost = (url: string | null) => {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const AgentDockOverlay = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const runId = useStore((s) => s.runId);
  const status = useStore((s) => s.status);
  const task = useStore((s) => s.task);
  const currentStep = useStore((s) => s.currentStep);
  const maxSteps = useStore((s) => s.maxSteps);
  const elapsedTime = useStore((s) => s.elapsedTime);
  const currentScreenshot = useStore((s) => s.currentScreenshot);
  const browserUrl = useStore((s) => s.browserUrl);
  const browserTitle = useStore((s) => s.browserTitle);
  const lastSurface = useStore((s) => s.lastSurface);
  const entries = useStore((s) => s.entries);
  const stopAgent = useStore((s) => s.stopAgent);
  const [collapsed, setCollapsed] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const autoOpenedRunRef = useRef<string | null>(null);

  const visible = !!task && (status === 'running' || status === 'paused' || status === 'error');

  const latestEntry = useMemo(
    () => entries.find((entry) => entry.type !== 'info') ?? entries[0] ?? null,
    [entries],
  );

  const host = extractHost(browserUrl);

  const openDockWindow = () => {
    if (typeof window === 'undefined') {
      return;
    }
    const popup = window.open(
      '/agent-dock',
      'agentos-live-dock',
      'popup=yes,width=440,height=760,resizable=yes,scrollbars=no',
    );
    if (popup) {
      popupRef.current = popup;
      popup.focus();
    }
  };

  useEffect(() => {
    if (!visible || !runId || location.pathname === '/agent-dock') {
      return;
    }
    if (autoOpenedRunRef.current === runId) {
      return;
    }
    autoOpenedRunRef.current = runId;
    openDockWindow();
  }, [location.pathname, runId, visible]);

  if (!visible || location.pathname === '/agent-dock') {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[82] flex w-[min(380px,calc(100vw-1.5rem))] justify-end md:bottom-5 md:right-5">
      <div className="pointer-events-auto w-full overflow-hidden rounded-[24px] border border-white/12 bg-[rgba(11,14,24,0.92)] shadow-[0_24px_80px_rgba(3,7,18,0.45)] backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex min-w-0 items-center gap-2 text-left transition-opacity hover:opacity-100"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-sky-300/18 bg-sky-400/10 text-sky-100">
              {lastSurface === 'terminal' ? <MonitorSmartphone size={15} /> : <Globe size={15} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-100/72">
                <Radio size={11} className="animate-pulse" />
                Agent live
              </div>
              <div className="truncate text-sm font-medium text-white/94">
                {latestEntry?.toolLabel || latestEntry?.action || task}
              </div>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={openDockWindow}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/72 transition-colors hover:text-white"
              aria-label="Open detachable live dock"
            >
              <ArrowUpRight size={14} />
            </button>
            <button
              onClick={() => setCollapsed((value) => !value)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/72 transition-colors hover:text-white"
              aria-label={collapsed ? 'Expand live dock' : 'Collapse live dock'}
            >
              <ChevronUp size={14} className={collapsed ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="space-y-3 px-4 py-4">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-[11px] text-white/70">
              <span className="truncate rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                {host || browserTitle || 'Desktop workflow'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                Step {currentStep}/{maxSteps}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                {formatTime(elapsedTime)}
              </span>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="group block w-full overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04] text-left"
            >
              {currentScreenshot ? (
                <img
                  src={`data:image/jpeg;base64,${currentScreenshot}`}
                  alt="Agent live preview"
                  className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                />
              ) : (
                <div className="flex h-32 items-center justify-center bg-[linear-gradient(180deg,rgba(112,140,255,0.18),rgba(12,16,28,0.96))] text-sm text-white/64">
                  Live preview is syncing...
                </div>
              )}
            </button>

            <div className="space-y-1">
              <div className="text-sm font-medium text-white/92">{task}</div>
              <div className="line-clamp-2 text-sm text-white/62">
                {latestEntry?.reasoning || latestEntry?.action || 'AgentOS is working through the current task.'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-white/12 bg-white/6 px-3 py-2 text-sm font-medium text-white/88 transition-colors hover:bg-white/10"
              >
                Open workspace
              </button>
              <button
                onClick={stopAgent}
                className="inline-flex items-center justify-center rounded-full border border-red-400/18 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-500/16"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentDockOverlay;
