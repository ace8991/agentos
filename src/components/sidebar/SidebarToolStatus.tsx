import { useStore } from '@/store/useStore';

const tools = [
  { name: 'Tavily', key: 'tavily' },
  { name: 'Playwright', key: 'playwright' },
  { name: 'PyAutoGUI', key: 'pyautogui' },
  { name: 'Computer Use', key: 'computer_use' },
];

const SidebarToolStatus = () => {
  const backendOnline = useStore((s) => s.backendOnline);

  return (
    <div className="px-4 py-3 border-t border-border">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-2">
        Tool status
      </span>
      <div className="space-y-1">
        {tools.map((tool) => (
          <div key={tool.key} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  backendOnline ? 'bg-success' : 'bg-muted-foreground'
                }`}
              />
              <span>{tool.name}</span>
            </div>
            <span className={`text-[10px] ${backendOnline ? 'text-success' : 'text-muted-foreground'}`}>
              {backendOnline ? 'Active' : 'Offline'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SidebarToolStatus;
