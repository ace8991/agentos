import { useEffect, useState } from 'react';
import { ArrowUpRight, Globe, Radio, TerminalSquare } from 'lucide-react';
import { readAgentDockSnapshot, subscribeAgentDockSnapshot, type AgentDockSnapshot } from '@/lib/agent-dock-bridge';
import { getOpenClawOverlayPrefs } from '@/lib/openclaw';

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

const AgentDockWindow = () => {
  const [snapshot, setSnapshot] = useState<AgentDockSnapshot | null>(() => readAgentDockSnapshot());
  const overlayPrefs = getOpenClawOverlayPrefs();

  useEffect(() => {
    document.title = 'AgentOS Live';
    return subscribeAgentDockSnapshot(setSnapshot);
  }, []);

  const host = extractHost(snapshot?.browserUrl ?? null);

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,_rgba(90,126,255,0.18),_transparent_32%),linear-gradient(180deg,#111521_0%,#090b12_100%)] text-white">
      <div className="flex min-h-screen w-full flex-col px-4 py-4">
        <div className="rounded-[28px] border border-white/10 bg-[rgba(10,14,23,0.88)] shadow-[0_30px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/72">
                <Radio size={11} className="animate-pulse" />
                Agent live dock
              </div>
              <div className="mt-1 text-sm font-medium text-white/92">
                {snapshot?.latestToolLabel || snapshot?.latestAction || 'Waiting for an active run'}
              </div>
            </div>
            <button
              onClick={() => window.open('/dashboard', 'agentos-main-workspace')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/76 transition-colors hover:text-white"
              aria-label="Open main workspace"
            >
              <ArrowUpRight size={15} />
            </button>
          </div>

          <div className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2 text-[11px] text-white/70">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-center">
                {host || snapshot?.browserTitle || 'Desktop'}
              </span>
              {overlayPrefs.voiceOverlay && (
                <span className="rounded-full border border-cyan-300/18 bg-cyan-400/10 px-2.5 py-1 text-center text-cyan-100">
                  {overlayPrefs.voiceWake ? 'Voice wake on' : 'Voice ready'}
                </span>
              )}
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-center">
                Step {snapshot?.currentStep ?? 0}/{snapshot?.maxSteps ?? 0}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-center">
                {formatTime(snapshot?.elapsedTime ?? 0)}
              </span>
            </div>

            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0d1119]">
              {snapshot?.currentScreenshot ? (
                <img
                  src={`data:image/jpeg;base64,${snapshot.currentScreenshot}`}
                  alt="Agent live preview"
                  className="h-[300px] w-full object-cover"
                />
              ) : (
                <div className="flex h-[300px] items-center justify-center bg-[linear-gradient(180deg,rgba(112,140,255,0.18),rgba(9,11,18,1))] text-sm text-white/58">
                  Waiting for a live preview...
                </div>
              )}
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-2 text-sm font-medium text-white/92">{snapshot?.task || 'No active task yet'}</div>
              <div className="text-sm leading-relaxed text-white/64">
                {snapshot?.latestReasoning || snapshot?.latestAction || 'AgentOS will stream browser and desktop activity here while it works.'}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-[12px] text-white/72">
              <div className="inline-flex items-center gap-2">
                {snapshot?.lastSurface === 'terminal' ? <TerminalSquare size={14} /> : <Globe size={14} />}
                {snapshot?.lastSurface === 'terminal' ? 'Terminal surface active' : 'Browser surface active'}
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/18 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-100">
                <Radio size={11} className="animate-pulse" />
                {snapshot?.visible ? 'LIVE' : 'IDLE'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentDockWindow;
