import { useStore } from '@/store/useStore';

const AgentBrainVisualizer = () => {
  const status = useStore((s) => s.status);
  if (status !== 'running') return null;

  const layers = [10, 30, 50, 70, 90];

  return (
    <div className="relative mx-auto mb-4 flex items-center justify-center">
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, hsl(263 84% 58% / 0.12) 0%, transparent 70%)',
        }}
      />
      <svg width="200" height="120" viewBox="0 0 200 120">
        {layers.map((y, i) => (
          <rect
            key={i}
            x="20"
            y={y}
            width="160"
            height="12"
            rx="4"
            fill="hsl(240 20% 12%)"
            stroke="hsl(0 0% 100% / 0.06)"
            strokeWidth="1"
          />
        ))}
        <circle cx="0" cy="60" r="5" fill="hsl(36 91% 44%)" className="brain-dot-animate" />
      </svg>
    </div>
  );
};

export default AgentBrainVisualizer;
