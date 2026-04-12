import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

const LABELS = ['Analyzing your request…','Checking context…','Working on it…','Preparing response…'];
const SKIP = new Set(['Agent is working...','Thinking...','Processing...','Waiting for your input...']);

export const ThinkingIndicator = ({ label }: { label?: string }) => {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT(n => n+1), 2400); return () => clearInterval(id); }, []);
  const text = !label || SKIP.has(label) ? LABELS[t % LABELS.length] : label;
  return (
    <div className="flex items-center gap-3 px-4 py-3 log-entry-enter">
      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--surface-elevated))]">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground/[0.05]" />
        <div className="relative z-10 flex gap-[3px]">
          {[0,1,2].map(i => (
            <span key={i} className="h-[5px] w-[5px] rounded-full bg-foreground/25"
              style={{ animation: `pulse-dot 1.1s ease-in-out ${i*0.18}s infinite` }} />
          ))}
        </div>
      </div>
      <span key={text} className="text-[14px] text-foreground/32 animate-in fade-in duration-500 italic">{text}</span>
    </div>
  );
};

export default ThinkingIndicator;
