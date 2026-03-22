const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-full text-center px-8">
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="mb-6 opacity-40">
      {/* Robot body */}
      <rect x="35" y="40" width="50" height="45" rx="8" fill="hsl(240 20% 16%)" stroke="hsl(0 0% 100% / 0.1)" strokeWidth="1.5" />
      {/* Head */}
      <rect x="40" y="20" width="40" height="25" rx="6" fill="hsl(240 20% 14%)" stroke="hsl(0 0% 100% / 0.1)" strokeWidth="1.5" />
      {/* Eyes closed (sleeping) */}
      <line x1="50" y1="33" x2="56" y2="33" stroke="hsl(0 0% 100% / 0.25)" strokeWidth="2" strokeLinecap="round" />
      <line x1="64" y1="33" x2="70" y2="33" stroke="hsl(0 0% 100% / 0.25)" strokeWidth="2" strokeLinecap="round" />
      {/* Antenna */}
      <line x1="60" y1="20" x2="60" y2="12" stroke="hsl(0 0% 100% / 0.15)" strokeWidth="1.5" />
      <circle cx="60" cy="10" r="3" fill="hsl(263 84% 58% / 0.4)" />
      {/* Arms */}
      <line x1="35" y1="55" x2="25" y2="65" stroke="hsl(0 0% 100% / 0.1)" strokeWidth="2" strokeLinecap="round" />
      <line x1="85" y1="55" x2="95" y2="65" stroke="hsl(0 0% 100% / 0.1)" strokeWidth="2" strokeLinecap="round" />
      {/* Zzz */}
      <text x="88" y="25" fill="hsl(263 84% 58% / 0.3)" fontSize="12" fontFamily="Inter">z</text>
      <text x="95" y="18" fill="hsl(263 84% 58% / 0.2)" fontSize="10" fontFamily="Inter">z</text>
    </svg>
    <h3 className="text-lg font-medium text-foreground mb-1.5">No tasks yet</h3>
    <p className="text-sm text-muted-foreground max-w-xs">Define a task and run your agent</p>
  </div>
);

export default EmptyState;
