import { Hand, ArrowRight } from 'lucide-react';
import { useStore } from '@/store/useStore';

const TakeoverBanner = () => {
  const takeoverRequested = useStore((s) => s.takeoverRequested);
  const takeoverReason = useStore((s) => s.takeoverReason);
  const releaseTakeover = useStore((s) => s.releaseTakeover);

  if (!takeoverRequested) return null;

  return (
    <div className="mx-5 mb-3 p-4 bg-accent/10 border border-accent/25 rounded-xl log-entry-enter">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
          <Hand size={16} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-foreground mb-1">Human interaction required</h4>
          <p className="text-xs text-muted-foreground mb-3">
            {takeoverReason || 'The agent needs you to take control of the browser to complete an action (e.g. CAPTCHA, login).'}
          </p>
          <button
            onClick={releaseTakeover}
            className="flex items-center gap-2 text-xs bg-accent text-accent-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity active:scale-[0.97] font-medium"
          >
            Done, resume agent
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TakeoverBanner;
