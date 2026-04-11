import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { checkDCHealth } from '@/lib/desktop-commander';

const tools = [
  { name: 'Tavily', key: 'tavily' },
  { name: 'Playwright', key: 'playwright' },
  { name: 'PyAutoGUI', key: 'pyautogui' },
  { name: 'Computer Use', key: 'computer_use' },
];

const SidebarToolStatus = ({ embedded = false }: { embedded?: boolean }) => {
  const backendOnline = useStore((s) => s.backendOnline);
  const backendHealth = useStore((s) => s.backendHealth);
  const [dcOnline, setDcOnline] = useState<boolean | null>(null);

  const toolState = backendHealth?.available_tools;
  const openclaw = backendHealth?.openclaw as
    | { gateway_status?: string; connected_devices?: number }
    | undefined;
  const runtimeMode =
    backendHealth?.mode === 'local'
      ? 'Local mode'
      : backendHealth?.mode === 'cloud'
      ? 'Cloud mode'
      : 'Offline';

  useEffect(() => {
    if (!backendOnline) { setDcOnline(false); return; }
    checkDCHealth().then(setDcOnline);
  }, [backendOnline]);

  const containerClassName = embedded
    ? 'rounded-xl border border-border bg-muted/30 p-3'
    : 'px-4 py-3 border-t border-border';

  const dot = (ok: boolean | null) =>
    ok === null ? 'bg-muted-foreground animate-pulse' : ok ? 'bg-success' : 'bg-warning';

  const lbl = (ok: boolean | null) =>
    !backendOnline ? 'Offline' : ok === null ? 'Checking…' : ok ? 'Ready' : 'Unavailable';

  return (
    <div className={containerClassName}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
          Tool status
        </span>
        <span className="text-[10px] text-muted-foreground">{runtimeMode}</span>
      </div>
      <div className="space-y-1">
        {tools.map((tool) => (
          <div key={tool.key} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  !backendOnline
                    ? 'bg-muted-foreground'
                    : toolState?.[tool.key as keyof typeof toolState]
                    ? 'bg-success'
                    : 'bg-warning'
                }`}
              />
              <span>{tool.name}</span>
            </div>
            <span className={`text-[10px] ${
              !backendOnline ? 'text-muted-foreground'
                : toolState?.[tool.key as keyof typeof toolState] ? 'text-success' : 'text-warning'
            }`}>
              {!backendOnline ? 'Offline' : toolState?.[tool.key as keyof typeof toolState] ? 'Ready' : 'Unavailable'}
            </span>
          </div>
        ))}

        {/* OpenClaw gateway (remote) */}
        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className={`w-1.5 h-1.5 rounded-full ${
              !backendOnline ? 'bg-muted-foreground'
                : openclaw?.gateway_status === 'ready' ? 'bg-success' : 'bg-warning'
            }`} />
            <span>OpenClaw gateway</span>
          </div>
          <span className={`text-[10px] ${
            !backendOnline ? 'text-muted-foreground'
              : openclaw?.gateway_status === 'ready' ? 'text-success' : 'text-warning'
          }`}>
            {!backendOnline ? 'Offline' : openclaw?.connected_devices ? `${openclaw.connected_devices} devices` : 'Pairing'}
          </span>
        </div>

        {/* Desktop Commander */}
        <div className="flex items-center justify-between text-xs border-t border-border/50 pt-1 mt-0.5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className={`w-1.5 h-1.5 rounded-full ${!backendOnline ? 'bg-muted-foreground' : dot(dcOnline)}`} />
            <span>Desktop Commander</span>
          </div>
          <span className={`text-[10px] ${
            !backendOnline ? 'text-muted-foreground' : dcOnline ? 'text-success' : 'text-warning'
          }`}>
            {lbl(dcOnline)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SidebarToolStatus;
