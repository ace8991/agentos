import { Cpu, MonitorSmartphone, Globe } from 'lucide-react';
import { useStore } from '@/store/useStore';

const SidebarModeSwitch = () => {
  const backendOnline = useStore((s) => s.backendOnline);
  const backendHealth = useStore((s) => s.backendHealth);

  const modeLabel = !backendOnline
    ? 'Offline'
    : backendHealth?.mode === 'local'
    ? 'Local workspace'
    : backendHealth?.mode === 'cloud'
    ? 'Cloud workspace'
    : 'Smart workspace';

  const detailLabel = !backendOnline
    ? 'Direct responses only until the backend reconnects'
    : backendHealth?.mode === 'local'
    ? 'Browser, terminal, desktop and live execution available'
    : 'Web and browser automation available from the server';

  const Icon = !backendOnline ? Globe : backendHealth?.mode === 'local' ? MonitorSmartphone : Cpu;

  return (
    <div className="px-4 pt-3 pb-1">
      <div className="rounded-xl border border-border bg-muted/60 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-elevated text-primary">
            <Icon size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">Smart Agent Workspace</p>
            <p className="text-[11px] text-muted-foreground">{modeLabel}</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {detailLabel}
        </p>
      </div>
    </div>
  );
};

export default SidebarModeSwitch;
