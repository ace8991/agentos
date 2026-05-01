import { useState } from 'react';
import { Brain, Check, ChevronDown, ChevronRight, Loader2, AlertTriangle, Layers, X } from 'lucide-react';

export interface SubAgent {
  id: string;
  title: string;
  status: 'running' | 'done' | 'error' | 'queued';
  progress?: string;
  steps: string[];
  result?: string;
}

const STATUS_STYLE: Record<string, { icon: JSX.Element; color: string }> = {
  running: { icon: <Loader2 size={12} className="animate-spin" />, color: 'text-primary-400' },
  done:    { icon: <Check size={12} />, color: 'text-primary-400' },
  error:   { icon: <AlertTriangle size={12} />, color: 'text-destructive' },
  queued:  { icon: <Brain size={12} className="opacity-40" />, color: 'text-muted-foreground' },
};

const DEMO_AGENTS: SubAgent[] = [
  {
    id: '1', title: 'Analyser la structure du projet', status: 'done',
    steps: ['Lecture de package.json', 'Scan de src/', 'Identification des patterns'],
    result: 'Projet React/TS avec 42 composants, architecture feature-based.',
  },
  {
    id: '2', title: 'Refactorer AuthContext', status: 'running',
    progress: 'Modification de src/contexts/AuthContext.tsx...',
    steps: ['Lecture du fichier', 'Analyse des dépendances', 'Écriture du nouveau code'],
  },
  {
    id: '3', title: 'Mettre à jour les tests', status: 'queued',
    steps: ['Attente de la tâche #2'],
  },
];

const SubAgentRow = ({ agent }: { agent: SubAgent }) => {
  const [open, setOpen] = useState(agent.status === 'running');
  const st = STATUS_STYLE[agent.status];

  return (
    <div className="border-b border-[hsl(0,0%,15%)] last:border-b-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[hsl(0,0%,13%)] transition-colors"
      >
        <div className={st.color}>{st.icon}</div>
        <span className="text-[12px] text-foreground/80 flex-1 truncate">{agent.title}</span>
        {open ? <ChevronDown size={12} className="text-foreground/30" /> : <ChevronRight size={12} className="text-foreground/20" />}
      </button>
      {open && (
        <div className="px-3 pb-2.5 pl-8 space-y-1">
          {agent.progress && (
            <p className="text-[11px] text-sky-400/70 font-mono">{agent.progress}</p>
          )}
          <div className="space-y-0.5">
            {agent.steps.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="w-1 h-1 rounded-full bg-foreground/20 shrink-0" />
                {s}
              </div>
            ))}
          </div>
          {agent.result && (
            <p className="text-[11px] text-emerald-400/70 mt-1 font-mono">{agent.result}</p>
          )}
        </div>
      )}
    </div>
  );
};

const SubAgentPanel = ({ onClose }: { onClose: () => void }) => {
  const [agents] = useState<SubAgent[]>(DEMO_AGENTS);

  const running = agents.filter(a => a.status === 'running').length;
  const done = agents.filter(a => a.status === 'done').length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(0,0%,17%)] bg-[hsl(0,0%,11%)]">
        <div className="flex items-center gap-1.5">
          <Layers size={13} className="text-sky-400" />
          <span className="text-xs font-medium text-foreground">Sous-agents</span>
          <span className="text-[10px] text-muted-foreground ml-1">{running} actifs · {done} terminés</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {agents.map(a => <SubAgentRow key={a.id} agent={a} />)}
      </div>
    </div>
  );
};

export default SubAgentPanel;
