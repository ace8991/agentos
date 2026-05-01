import { Cloud, Loader2, MonitorSmartphone } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface BackendStatusChipProps {
  className?: string;
}

/**
 * Compact connection-status chip displayed in the top bar (Claude.ai style).
 *
 * Three states, sourced from the existing `useStore` health polling
 * (handled by `RuntimeSync` in `App.tsx`):
 *  - checking: backend probe still in flight
 *  - online:   FastAPI backend reachable -> filesystem/terminal/git tools available
 *  - offline:  pure cloud mode -> only direct AI provider features
 */
const BackendStatusChip = ({ className }: BackendStatusChipProps) => {
  const backendOnline = useStore((s) => s.backendOnline);
  const backendChecked = useStore((s) => s.backendChecked);
  const backendHealth = useStore((s) => s.backendHealth);

  const state: 'checking' | 'online' | 'offline' = !backendChecked
    ? 'checking'
    : backendOnline
      ? 'online'
      : 'offline';

  const config = {
    checking: {
      Icon: Loader2,
      iconClass: 'animate-spin',
      label: 'Connecting',
      tooltip: 'Probing local backend on port 8000...',
      dotClass: 'bg-muted-foreground',
      pulse: false,
      chipClass: 'border-border/40 bg-muted/30 text-muted-foreground',
    },
    online: {
      Icon: MonitorSmartphone,
      iconClass: '',
      label: 'Local connected',
      tooltip: backendHealth?.version
        ? `Local backend online (v${backendHealth.version}) — filesystem, terminal & git available.`
        : 'Local backend online — filesystem, terminal & git available.',
      dotClass: 'bg-primary-400',
      pulse: true,
      chipClass: 'border-primary-500/30 bg-primary-500/10 text-primary-300',
    },
    offline: {
      Icon: Cloud,
      iconClass: '',
      label: 'Online mode',
      tooltip:
        'Cloud-only mode. Start the local backend (port 8000) to unlock filesystem, terminal & git tools.',
      dotClass: 'bg-primary-400',
      pulse: false,
      chipClass: 'border-primary-500/30 bg-primary-500/10 text-primary-300',
    },
  }[state];

  const { Icon } = config;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none transition-colors',
            config.chipClass,
            className,
          )}
          role="status"
          aria-live="polite"
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              config.dotClass,
              config.pulse && 'animate-pulse',
            )}
          />
          <Icon size={11} className={config.iconClass} aria-hidden="true" />
          <span className="hidden sm:inline">{config.label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
        {config.tooltip}
      </TooltipContent>
    </Tooltip>
  );
};

export default BackendStatusChip;
