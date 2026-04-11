import { useEffect, useState } from 'react';

const ROTATION = [
  'Analysing the task…',
  'Preparing tools…',
  'Working on it…',
  'Checking results…',
];

const ThinkingIndicator = ({ label }: { label?: string }) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2200);
    return () => clearInterval(id);
  }, []);

  const displayLabel = label && label !== 'Agent is working...'
    ? label
    : ROTATION[tick % ROTATION.length];

  return (
    <div className="flex items-center gap-3 py-2 log-entry-enter">
      {/* Animated orb */}
      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-400/10">
        <span className="absolute inline-flex h-4 w-4 animate-ping rounded-full bg-purple-400/20" />
        <div className="flex gap-[3px] relative z-10">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-purple-400/80"
              style={{ animation: `pulse-dot 1s ease-in-out ${i * 0.16}s infinite` }}
            />
          ))}
        </div>
      </div>
      {/* Label with fade transition */}
      <span
        key={displayLabel}
        className="text-xs italic text-white/54 animate-in fade-in duration-500"
      >
        {displayLabel}
      </span>
    </div>
  );
};

export default ThinkingIndicator;
