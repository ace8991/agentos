import { useState } from 'react';
import { ChevronDown, ChevronRight, MemoryStick, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';

const AgentMemory = () => {
  const [open, setOpen] = useState(true);
  const memory = useStore((s) => s.memory);
  const clearMemory = useStore((s) => s.clearMemory);
  const removeMemoryItem = useStore((s) => s.removeMemoryItem);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <MemoryStick size={14} />
        <span className="font-medium">Working memory</span>
        <span className="ml-auto text-xs bg-surface-elevated px-1.5 py-0.5 rounded-md tabular-nums">
          {memory.length}
        </span>
      </button>

      {open && (
        <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-1 pl-1">
          {memory.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No items stored yet</p>
          )}
          {memory.map((item) => (
            <div
              key={item.key}
              className="flex items-start gap-2 group text-xs py-1 px-2 rounded-md hover:bg-surface-elevated transition-colors"
            >
              <span className="font-mono text-muted-foreground shrink-0">{item.key}:</span>
              <span className="text-foreground break-all">{item.value}</span>
              <button
                onClick={() => removeMemoryItem(item.key)}
                className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {memory.length > 0 && (
            <button
              onClick={clearMemory}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors float-right py-1"
            >
              Clear memory
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentMemory;
