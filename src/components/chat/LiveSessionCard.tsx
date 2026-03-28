import { useEffect, useMemo, useState } from 'react';
import { Globe, Hand, Link2, Radio, Terminal, Wand2 } from 'lucide-react';
import { useStore } from '@/store/useStore';

type SurfaceTab = 'browser' | 'terminal';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const excerpt = (value: string | undefined, max = 210) => {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
};

const LiveSessionCard = () => {
  const status = useStore((s) => s.status);
  const entries = useStore((s) => s.entries);
  const currentScreenshot = useStore((s) => s.currentScreenshot);
  const browserUrl = useStore((s) => s.browserUrl);
  const browserTitle = useStore((s) => s.browserTitle);
  const lastSurface = useStore((s) => s.lastSurface);
  const takeoverRequested = useStore((s) => s.takeoverRequested);
  const currentStep = useStore((s) => s.currentStep);
  const maxSteps = useStore((s) => s.maxSteps);
  const elapsedTime = useStore((s) => s.elapsedTime);
  const task = useStore((s) => s.task);
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
    (browserTitle ? `Inspecting ${browserTitle}` : 'Preparing browser workspace');
  const timerLabel = `${String(Math.floor(elapsedTime / 60)).padStart(2, '0')}:${String(elapsedTime % 60).padStart(2, '0')}`;

  return (
    <div className="px-3 pt-3 md:px-5">
      <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(90,126,255,0.16),_transparent_36%),rgba(12,15,24,0.96)] shadow-[0_28px_90px_rgba(0,0,0,0.34)]">
        <div className="flex items-start justify-between gap-3 border-b border-white/8 px-4 py-3 md:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/72">
              Live browser session
            </p>
            <h3 className="mt-1 text-[15px] font-medium text-white/96 md:text-lg">
              {statusCopy}
            </h3>
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
            </div>
          </div>
          {visibleTabs.length > 1 ? (
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
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
            <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/18 bg-sky-400/10 px-3 py-1.5 text-[11px] font-medium text-sky-100">
              <Radio size={12} className="animate-pulse" />
              LIVE
            </div>
          )}
        </div>

        {activeTab === 'browser' && hasBrowserActivity ? (
          <div className="px-4 pb-4 pt-3 md:px-5 md:pb-5">
            <div className="rounded-[24px] bg-[linear-gradient(145deg,rgba(55,128,255,0.78),rgba(112,86,255,0.68)_42%,rgba(18,28,58,0.96))] p-[2px] shadow-[0_26px_70px_rgba(55,128,255,0.24)]">
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
                  {currentScreenshot ? (
                    <img
                      src={`data:image/jpeg;base64,${currentScreenshot}`}
                      alt="Live browser session"
                      className="h-[250px] w-full bg-[#f4f6fb] object-contain md:h-[370px]"
                    />
                  ) : (
                    <div className="flex h-[250px] items-center justify-center bg-[#111520] text-xs text-white/50 md:h-[370px]">
                      Preparing live browser view...
                    </div>
                  )}

                  {overlayCopy && (
                    <div className="pointer-events-none absolute bottom-4 right-4 max-w-[78%] rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-[12px] leading-relaxed text-white/92 shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur-xl md:max-w-[52%] md:text-[13px]">
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200/78">
                        <Wand2 size={11} />
                        Why this step
                      </div>
                      {overlayCopy}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 border-t border-white/8 bg-[#111522] px-4 py-3">
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#8bc3ff_0%,#5f8bff_52%,#8b74ff_100%)] shadow-[0_0_26px_rgba(116,173,255,0.65)] transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/18 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-100">
                    <Radio size={11} className="animate-pulse" />
                    LIVE
                  </span>
                </div>
              </div>
            </div>

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
            </div>
          </div>
        ) : null}

        {activeTab === 'terminal' && hasTerminalActivity ? (
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
