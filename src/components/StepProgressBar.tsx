import { useStore } from '@/store/useStore';

const StepProgressBar = () => {
  const currentStep = useStore((s) => s.currentStep);
  const maxSteps = useStore((s) => s.maxSteps);
  const pct = maxSteps > 0 ? (currentStep / maxSteps) * 100 : 0;

  return (
    <div className="h-1 w-full bg-muted relative group" title={`${Math.round(pct)}% complete`}>
      <div
        className="h-full transition-all duration-500 ease-out"
        style={{
          width: `${pct}%`,
          background: 'linear-gradient(90deg, hsl(263 84% 58%), hsl(174 84% 32%))',
        }}
      />
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-surface-elevated text-xs text-foreground px-2 py-1 rounded-md">
        {Math.round(pct)}%
      </div>
    </div>
  );
};

export default StepProgressBar;
