const ThinkingIndicator = ({ label = 'Agent is working...' }: { label?: string }) => (
  <div className="flex items-center gap-3 py-3 text-muted-foreground log-entry-enter">
    <div className="w-7 h-7 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0">
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1 h-1 rounded-full bg-primary"
            style={{ animation: `pulse-dot 1.2s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </div>
    </div>
    <span className="text-xs">{label}</span>
  </div>
);

export default ThinkingIndicator;
