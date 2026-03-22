import { useStore, type AgentMode } from '@/store/useStore';

const SidebarModeSwitch = () => {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);

  return (
    <div className="px-4 pt-3 pb-1">
      <div className="flex bg-muted p-0.5 rounded-lg border border-border">
        {(['chat', 'agent'] as AgentMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium capitalize transition-all active:scale-[0.97] ${
              mode === m
                ? 'bg-surface-elevated text-foreground border border-border shadow-sm'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SidebarModeSwitch;
