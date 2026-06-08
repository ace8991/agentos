import { useEffect, useState } from 'react';
import { Check, Copy, Terminal, X } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'agentos_local_banner_dismissed';
const BACKEND_COMMAND = 'python -m uvicorn backend.app.main:app --port 8000';

interface LocalConnectionBannerProps {
  className?: string;
}

/**
 * Slim, dismissible banner shown when the FastAPI backend is unreachable.
 *
 * Non-blocking by design (the existing `BackendOfflineOverlay` only
 * activates for actions that strictly require the backend). This banner
 * surfaces the start command so the user can switch to local mode in
 * one click + paste.
 */
const LocalConnectionBanner = ({ className }: LocalConnectionBannerProps) => {
  const backendOnline = useStore((s) => s.backendOnline);
  const backendChecked = useStore((s) => s.backendChecked);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  if (!backendChecked || backendOnline || dismissed) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(BACKEND_COMMAND);
      setCopied(true);
      toast.success('Command copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — please copy the command manually');
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        'relative z-30 flex flex-wrap items-center gap-3 border-b border-primary/20 bg-[linear-gradient(90deg,hsl(var(--primary)/0.10),hsl(var(--primary)/0.04))] px-4 py-2 text-xs text-primary-foreground/90 backdrop-blur-md',
        className,
      )}
      role="status"
    >
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
        <Terminal size={12} aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
        <span className="text-foreground/80">
          <span className="font-medium text-foreground">Online mode active.</span>{' '}
          Start the local backend to unlock filesystem, terminal & git:
        </span>

        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2 py-1 font-mono text-[11px] text-foreground/90">
          <code className="truncate max-w-[260px] sm:max-w-none">{BACKEND_COMMAND}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
            aria-label="Copy command"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default LocalConnectionBanner;
