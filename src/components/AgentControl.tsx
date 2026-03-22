import { Settings, PlayCircle, Square } from 'lucide-react';
import { useStore } from '@/store/useStore';
import HexLogo from './HexLogo';
import AgentBrainVisualizer from './AgentBrainVisualizer';
import AgentMemory from './AgentMemory';
import { MODEL_PROVIDERS } from './ModelSelector';

const allModels = MODEL_PROVIDERS.flatMap((p) => p.models.map((m) => ({ id: m.id, label: `${p.icon} ${m.name}` })));
const intervals = [
  { label: '500ms', value: 500 },
  { label: '1s', value: 1000 },
  { label: '2s', value: 2000 },
  { label: '5s', value: 5000 },
];

const AgentControl = () => {
  const task = useStore((s) => s.task);
  const setTask = useStore((s) => s.setTask);
  const model = useStore((s) => s.model);
  const setModel = useStore((s) => s.setModel);
  const maxSteps = useStore((s) => s.maxSteps);
  const setMaxSteps = useStore((s) => s.setMaxSteps);
  const captureInterval = useStore((s) => s.captureInterval);
  const setCaptureInterval = useStore((s) => s.setCaptureInterval);
  const status = useStore((s) => s.status);
  const startAgent = useStore((s) => s.startAgent);
  const stopAgent = useStore((s) => s.stopAgent);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  const isRunning = status === 'running';

  return (
    <div className="w-[380px] shrink-0 h-screen bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <HexLogo />
          <span className="text-foreground font-medium tracking-tight">AgentOS</span>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-surface-elevated active:scale-95"
        >
          <Settings size={17} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
        {/* Task input */}
        <div>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Describe what the agent should do..."
            rows={4}
            disabled={isRunning}
            className="w-full bg-muted border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:glow-purple transition-shadow disabled:opacity-50"
          />
        </div>

        {/* Config */}
        <div className="space-y-2.5">
          <ConfigRow label="Model">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={isRunning}
              className="bg-muted border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 w-full"
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </ConfigRow>
          <ConfigRow label="Max steps">
            <input
              type="number"
              min={1}
              max={100}
              value={maxSteps}
              onChange={(e) => setMaxSteps(Number(e.target.value))}
              disabled={isRunning}
              className="bg-muted border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 w-20 tabular-nums text-center"
            />
          </ConfigRow>
          <ConfigRow label="Capture">
            <select
              value={captureInterval}
              onChange={(e) => setCaptureInterval(Number(e.target.value))}
              disabled={isRunning}
              className="bg-muted border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 w-full"
            >
              {intervals.map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
          </ConfigRow>
        </div>

        {/* Brain visualizer */}
        <AgentBrainVisualizer />

        {/* Buttons */}
        {!isRunning ? (
          <button
            onClick={startAgent}
            disabled={!task.trim() || isRunning}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium text-sm py-2.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-40 active:scale-[0.98]"
          >
            <PlayCircle size={17} />
            Run Agent
          </button>
        ) : (
          <button
            onClick={stopAgent}
            className="w-full flex items-center justify-center gap-2 border border-destructive text-destructive font-medium text-sm py-2.5 rounded-md hover:bg-destructive/10 transition-colors active:scale-[0.98]"
          >
            <Square size={15} />
            Stop
          </button>
        )}

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Memory */}
        <AgentMemory />
      </div>
    </div>
  );
};

const ConfigRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <label className="text-sm text-muted-foreground shrink-0">{label}</label>
    <div className="flex-1 max-w-[200px]">{children}</div>
  </div>
);

export default AgentControl;
