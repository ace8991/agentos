import { useStore } from '@/store/useStore';

const tools = [
  { name: 'Tavily', key: 'tavily' },
  { name: 'Playwright', key: 'playwright' },
  { name: 'PyAutoGUI', key: 'pyautogui' },
  { name: 'Computer Use', key: 'computer_use' },
];

const SidebarToolStatus = () => {
  const backendOnline = useStore((s) => s.backendOnline);
  const backendHealth = useStore((s) => s.backendHealth);

  const toolState = backendHealth?.available_tools;
  const runtimeMode = backendHealth?.mode === 'local' ? 'Local mode' : backendHealth?.mode === 'cloud' ? 'Cloud mode' : 'Offline';

  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
        Tool status
        </span>
        <span className="text-[10px] text-muted-foreground">{runtimeMode}</span>
      </div>
      <div className="space-y-1">
        {tools.map((tool) => (
          <div key={tool.key} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  !backendOnline
                    ? 'bg-muted-foreground'
                    : toolState?.[tool.key as keyof typeof toolState]
                    ? 'bg-success'
                    : 'bg-warning'
                }`}
              />
              <span>{tool.name}</span>
            </div>
            <span
              className={`text-[10px] ${
                !backendOnline
                  ? 'text-muted-foreground'
                  : toolState?.[tool.key as keyof typeof toolState]
                  ? 'text-success'
                  : 'text-warning'
              }`}
            >
              {!backendOnline ? 'Offline' : toolState?.[tool.key as keyof typeof toolState] ? 'Ready' : 'Unavailable'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SidebarToolStatus;
