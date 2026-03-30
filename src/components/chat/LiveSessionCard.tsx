import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  Hand,
  Link2,
  Maximize2,
  Minimize2,
  Radio,
  Terminal,
  X,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import LiveBrowserView from '@/components/LiveBrowserView';
import { getOpenClawOverlayPrefs } from '@/lib/openclaw';

type SurfaceTab = 'browser' | 'terminal';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const excerpt = (value: string | undefined, max = 210) => {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
};

const isLikelyBrowserTask = (task: string) =>
  /\b(site|website|web|browser|amazon|github|google|youtube|linkedin|notion|canva|navigate|ouvre|open|visit|recherche|cherche|search|commande|order|orders)\b/i.test(
    task,
  );

const LiveSessionCard = () => {
  const status = useStore((s) => s.status);
  const entries = useStore((s) => s.entries);
  const browserUrl = useStore((s) => s.browserUrl);
  const browserTitle = useStore((s) => s.browserTitle);
  const lastSurface = useStore((s) => s.lastSurface);
  const takeoverRequested = useStore((s) => s.takeoverRequested);
  const currentStep = useStore((s) => s.currentStep);
  const maxSteps = useStore((s) => s.maxSteps);
  const elapsedTime = useStore((s) => s.elapsedTime);
  const task = useStore((s) => s.task);
  const runId = useStore((s) => s.runId);
  const currentScreenshot = useStore((s) => s.currentScreenshot);
  const [activeTab, setActiveTab] = useState<SurfaceTab>('browser');
  const [collapsed, setCollapsed] = useState(false);
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const overlayPrefs = getOpenClawOverlayPrefs();

  const isLive = status === 'running' || status === 'paused';
  const isSettled = status === 'done' || status === 'error';
  const browserEntries = useMemo(() => entries.filter((entry) => entry.type === 'browser'), [entries]);
  const terminalEntries = useMemo(() => entries.filter((entry) => entry.type === 'shell').slice(0, 6), [entries]);
  const hasBrowserArtifacts = browserEntries.length > 0 || !!browserUrl || !!browserTitle || !!currentScreenshot;
  const hasTerminalActivity = (isLive || isSettled) && terminalEntries.length > 0;
  const wantsBrowserWorkspace =
    !!task &&
    (hasBrowserArtifacts || lastSurface === 'browser' || isLikelyBrowserTask(task));
  const visibleTabs = [
    wantsBrowserWorkspace ? 'browser' : null,
    hasTerminalActivity ? 'terminal' : null,
  ].filter(Boolean) as SurfaceTab[];

  useEffect(() => {
    if (isLive && wantsBrowserWorkspace) {
      setCollapsed(false);
      return;
    }
    if (isSettled && wantsBrowserWorkspace) {
      setCollapsed(true);
    }
  }, [isLive, isSettled, wantsBrowserWorkspace]);

  useEffect(() => {
    if (lastSurface === 'terminal' && hasTerminalActivity) {
      setActiveTab('terminal');
      return;
    }
    if (wantsBrowserWorkspace) {
      setActiveTab('browser');
      return;
    }
    if (hasTerminalActivity) {
      setActiveTab('terminal');
    }
  }, [hasTerminalActivity, lastSurface, wantsBrowserWorkspace]);

  if (!wantsBrowserWorkspace && !hasTerminalActivity) {
    return null;
  }

  const latestBrowserEntry = browserEntries[0];
  const host = browserUrl
    ? (() => {
        try {
          return new URL(browserUrl).host;
        } catch {
          return browserUrl;
        }
      })()
    : null;
  const progress = maxSteps > 0 ? clamp((currentStep / maxSteps) * 100, 6, 100) : 8;
  const overlayCopy =
    excerpt(latestBrowserEntry?.reasoning) ||
    excerpt(typeof latestBrowserEntry?.tool_result?.text_preview === 'string' ? latestBrowserEntry.tool_result.text_preview : '') ||
    excerpt(latestBrowserEntry?.action) ||
    excerpt(task);
  const statusCopy =
    latestBrowserEntry?.toolLabel ||
    latestBrowserEntry?.action ||
    (browserTitle ? `Inspecting ${browserTitle}` : isLive ? 'Opening browser workspace' : 'Browser workspace ready');
  const timerLabel = `${String(Math.floor(elapsedTime / 60)).padStart(2, '0')}:${String(elapsedTime % 60).padStart(2, '0')}`;

  const terminalPreview = (
    <div className="max-h-[320px] overflow-y-auto bg-[#07090f] p-4 font-mono text-xs md:p-5">
      <div className="space-y-2">
        {terminalEntries.map((entry) => (
          <div key={entry.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <div className="text-[11px] text-emerald-300">$ {entry.action}</div>
            {entry.tool_result && (
              <pre className="mt-2 whitespace-pre-wrap break-all text-[11px] text-slate-300/92">
                {JSON.stringify(entry.tool_result, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const browserViewport = isLive ? (
    <LiveBrowserView
      runId={runId}
      isRunning={isLive}
      currentReasoning={overlayCopy}
    />
  ) : currentScreenshot ? (
    <div className="relative h-full w-full bg-[#0e0e16]">
      <img
        src={`data:image/jpeg;base64,${currentScreenshot}`}
        alt="Agent browser preview"
        className="h-full w-full object-contain"
      />
    </div>
  ) : (
    <div className="flex h-full items-center justify-center bg-[#0e0e16] text-sm text-white/60">
      Preview is ready to reopen.
    </div>
  );

  const browserStage = (
    <div className="rounded-[24px] bg-[linear-gradient(145deg,rgba(55,128,255,0.84),rgba(112,86,255,0.72)_42%,rgba(18,28,58,0.98))] p-[2px] shadow-[0_26px_70px_rgba(55,128,255,0.24)]">
      <div className="overflow-hidden rounded-[22px] bg-[#0d1018]">
        <div className="flex items-center gap-2 border-b border-white/8 bg-[#161a24] px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="ml-3 min-w-0 rounded-full border border-white/8 bg-white/[0.06] px-3 py-1 text-[11px] text-white/68">
            <span className="block truncate">{host || browserUrl || 'Preparing browser session'}</span>
          </div>
        </div>

        <div className="relative bg-[#f4f6fb]">
          <div className="h-[250px] md:h-[370px]">
            {browserViewport}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-white/8 bg-[#111522] px-4 py-3">
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#8bc3ff_0%,#5f8bff_52%,#8b74ff_100%)] shadow-[0_0_26px_rgba(116,173,255,0.65)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/18 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-100">
            <Radio size={11} className={isLive ? 'animate-pulse' : undefined} />
            LIVE
          </span>
        </div>
      </div>
    </div>
  );

  const fullPreview = fullPreviewOpen
    ? createPortal(
        <div className="fixed inset-0 z-[95] bg-black/72 px-4 py-5 backdrop-blur-md">
          <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-[32px] border border-white/12 bg-[#090c14] shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/72">Agent preview</p>
                <h3 className="mt-1 text-lg font-medium text-white/96">{statusCopy}</h3>
              </div>
              <div className="flex items-center gap-2">
                {browserUrl && (
                  <a
                    href={browserUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/6 px-3 py-2 text-sm text-white/88 transition-colors hover:bg-white/10"
                  >
                    <ExternalLink size={14} />
                    Open external
                  </a>
                )}
                <button
                  onClick={() => setFullPreviewOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/78 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-4 md:p-5">
              {activeTab === 'terminal' && hasTerminalActivity ? (
                terminalPreview
              ) : (
                <div className="min-h-0 flex-1">
                  {browserViewport}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  if (collapsed) {
    return (
      <>
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(10,14,24,0.9)] shadow-[0_24px_80px_rgba(3,7,18,0.35)]">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-300/18 bg-sky-400/10 text-sky-100">
                <Bot size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100/72">
                  Agent browser summary
                </p>
                <div className="truncate text-sm font-medium text-white/92">{statusCopy}</div>
                <div className="mt-1 truncate text-xs text-white/60">
                  {browserTitle || host || overlayCopy || task}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCollapsed(false)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/6 px-3 py-2 text-xs font-medium text-white/84 transition-colors hover:bg-white/10"
              >
                <ChevronDown size={13} />
                Reopen
              </button>
              <button
                onClick={() => setFullPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/18 bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-100 transition-colors hover:bg-sky-400/16"
              >
                <Maximize2 size={13} />
                Full preview
              </button>
            </div>
          </div>
        </div>
        {fullPreview}
      </>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(90,126,255,0.16),_transparent_36%),rgba(12,15,24,0.96)] shadow-[0_28px_90px_rgba(0,0,0,0.34)]">
        <div className="flex items-start justify-between gap-3 border-b border-white/8 px-4 py-3 md:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/72">
              Live browser session
            </p>
            <h3 className="mt-1 text-[15px] font-medium text-white/96 md:text-lg">{statusCopy}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {host && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/72">
                  <Link2 size={11} />
                  {host}
                </span>
              )}
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/72">
                Step {currentStep}/{maxSteps}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/72">
                {timerLabel}
              </span>
              {takeoverRequested && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[11px] text-amber-100">
                  <Hand size={11} />
                  Waiting for you
                </span>
              )}
              {overlayPrefs.mobileHud && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/18 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-100">
                  <Radio size={11} />
                  Mobile HUD
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {visibleTabs.length > 1 && (
              <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 md:inline-flex">
                <TabButton
                  active={activeTab === 'browser'}
                  disabled={!wantsBrowserWorkspace}
                  icon={Globe}
                  label="Preview"
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
            )}
            {browserUrl && (
              <a
                href={browserUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/72 transition-colors hover:text-white"
                title="Open external preview"
              >
                <ExternalLink size={14} />
              </a>
            )}
            <button
              onClick={() => setFullPreviewOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sky-300/18 bg-sky-400/10 text-sky-100 transition-colors hover:bg-sky-400/16"
              title="Open full preview"
            >
              <Maximize2 size={14} />
            </button>
            {(isSettled || wantsBrowserWorkspace) && (
              <button
                onClick={() => setCollapsed(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/72 transition-colors hover:text-white"
                title="Minimize preview"
              >
                <Minimize2 size={14} />
              </button>
            )}
          </div>
        </div>

        {activeTab === 'terminal' && hasTerminalActivity ? (
          terminalPreview
        ) : (
          <div className="px-4 pb-4 pt-3 md:px-5 md:pb-5">
            {browserStage}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {browserTitle && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/76">
                  {browserTitle}
                </span>
              )}
              {latestBrowserEntry?.toolLabel && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/76">
                  {latestBrowserEntry.toolLabel}
                </span>
              )}
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/76">
                {isLive ? 'Agent is navigating live in the workspace' : 'Preview ready'}
              </span>
            </div>
          </div>
        )}
      </div>
      {fullPreview}
    </>
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
      active
        ? 'bg-white text-slate-900 shadow-sm'
        : 'text-white/62 hover:text-white'
    } disabled:cursor-default disabled:opacity-45`}
  >
    <Icon size={12} />
    {label}
  </button>
);

export default LiveSessionCard;
