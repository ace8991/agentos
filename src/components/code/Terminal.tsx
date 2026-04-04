import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2 } from 'lucide-react';

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
}

const Terminal = () => {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: '0', type: 'system', content: '# AgentOS Terminal v1.0' },
    { id: '1', type: 'system', content: '# Tapez une commande ou laissez l\'IA exécuter pour vous.' },
    { id: '2', type: 'input', content: '$ npm run dev' },
    { id: '3', type: 'output', content: '  VITE v5.4.19  ready in 245 ms' },
    { id: '4', type: 'output', content: '' },
    { id: '5', type: 'output', content: '  ➜  Local:   http://localhost:5173/' },
    { id: '6', type: 'output', content: '  ➜  Network: http://192.168.1.100:5173/' },
  ]);
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const handleCommand = () => {
    if (!input.trim()) return;
    const cmd = input.trim();
    const newLines: TerminalLine[] = [
      { id: Date.now().toString(), type: 'input', content: `$ ${cmd}` },
    ];

    // Simulate common commands
    if (cmd === 'ls') {
      newLines.push({ id: `${Date.now()}-1`, type: 'output', content: 'src/  backend/  node_modules/  package.json  tsconfig.json  vite.config.ts' });
    } else if (cmd === 'pwd') {
      newLines.push({ id: `${Date.now()}-1`, type: 'output', content: '/home/user/agentos' });
    } else if (cmd.startsWith('git ')) {
      newLines.push({ id: `${Date.now()}-1`, type: 'output', content: `On branch main\nYour branch is up to date with 'origin/main'.\nnothing to commit, working tree clean` });
    } else if (cmd === 'clear') {
      setLines([]);
      setInput('');
      return;
    } else if (cmd.startsWith('npm ') || cmd.startsWith('yarn ') || cmd.startsWith('pnpm ')) {
      newLines.push({ id: `${Date.now()}-1`, type: 'output', content: `Running "${cmd}"...` });
      newLines.push({ id: `${Date.now()}-2`, type: 'output', content: '✓ Done in 1.2s' });
    } else {
      newLines.push({ id: `${Date.now()}-1`, type: 'error', content: `bash: ${cmd.split(' ')[0]}: commande simulée – connectez le backend pour l'exécution réelle` });
    }

    setLines((prev) => [...prev, ...newLines]);
    setInput('');
  };

  return (
    <div className={`flex flex-col border-t border-border bg-background ${expanded ? 'h-80' : 'h-44'}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <TerminalIcon size={12} className="text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground">Terminal</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
            {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button onClick={() => setLines([])} className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
            <X size={12} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 font-mono text-xs">
        {lines.map((line) => (
          <div key={line.id} className={`whitespace-pre-wrap ${
            line.type === 'error' ? 'text-destructive' :
            line.type === 'input' ? 'text-primary' :
            line.type === 'system' ? 'text-muted-foreground' :
            'text-foreground/70'
          }`}>
            {line.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-border">
        <span className="text-xs text-primary font-mono">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
          placeholder="Entrez une commande..."
          className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
};

export default Terminal;
