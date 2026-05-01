import { useState } from 'react';
import {
  Brain, Check, ChevronDown, ChevronRight, FileText, FolderOpen,
  Loader2, Search, Terminal, X, Zap, TestTube, Eye, GitBranch,
  AlertTriangle,
} from 'lucide-react';

export type ActionStepType =
  | 'think' | 'read_file' | 'write_file' | 'edit_file'
  | 'bash' | 'search' | 'test' | 'list_dir' | 'plan' | 'verify';

export type ActionStepStatus = 'running' | 'done' | 'error';

export interface ActionStep {
  id: string;
  type: ActionStepType;
  status: ActionStepStatus;
  label: string;
  detail?: string;
  filePath?: string;
  command?: string;
  duration?: number;
}

const STEP_CONFIG: Record<ActionStepType, { Icon: typeof Eye; color: string; bgColor: string }> = {
  think:     { Icon: Brain,      color: 'text-primary-400',  bgColor: 'bg-primary-500/10' },
  read_file: { Icon: FileText,   color: 'text-primary-400',   bgColor: 'bg-primary-500/10' },
  write_file:{ Icon: FileText,   color: 'text-primary-400', bgColor: 'bg-primary-500/10' },
  edit_file: { Icon: FileText,   color: 'text-primary-400',    bgColor: 'bg-primary-500/10' },
  bash:      { Icon: Terminal,    color: 'text-primary-400',   bgColor: 'bg-primary-500/10' },
  search:    { Icon: Search,     color: 'text-primary-400',     bgColor: 'bg-primary-500/10' },
  test:      { Icon: TestTube,   color: 'text-primary-400',  bgColor: 'bg-primary-500/10' },
  list_dir:  { Icon: FolderOpen, color: 'text-primary-400',   bgColor: 'bg-primary-500/10' },
  plan:      { Icon: Zap,        color: 'text-primary',     bgColor: 'bg-primary/10' },
  verify:    { Icon: Check,      color: 'text-primary-400', bgColor: 'bg-primary-500/10' },
};

const StatusIcon = ({ status }: { status: ActionStepStatus }) => {
  if (status === 'running') return <Loader2 size={10} className="animate-spin text-muted-foreground" />;
  if (status === 'error') return <AlertTriangle size={10} className="text-destructive" />;
  return <Check size={10} className="text-emerald-400" />;
};

const AgentActionStep = ({ step }: { step: ActionStep }) => {
  const [open, setOpen] = useState(false);
  const cfg = STEP_CONFIG[step.type];
  const { Icon } = cfg;
  const hasDetail = !!step.detail;

  return (
    <div className="flex items-start gap-2 py-0.5 group">
      <div className={`mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm ${step.status === 'error' ? 'bg-destructive/10' : cfg.bgColor}`}>
        <Icon size={11} className={step.status === 'error' ? 'text-destructive' : cfg.color} />
      </div>
      <div className="flex-1 min-w-0">
        <button
          onClick={() => hasDetail && setOpen(o => !o)}
          className={`flex w-full items-center gap-1.5 text-left ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <span className="text-[12px] text-foreground/50 leading-5 truncate flex-1">{step.label}</span>
          <StatusIcon status={step.status} />
          {step.duration != null && step.status === 'done' && (
            <span className="text-[10px] text-muted-foreground shrink-0">{step.duration}ms</span>
          )}
          {hasDetail && (
            open
              ? <ChevronDown size={11} className="shrink-0 text-foreground/30" />
              : <ChevronRight size={11} className="shrink-0 text-foreground/20 group-hover:text-foreground/35 transition-colors" />
          )}
        </button>
        {open && step.detail && (
          <div className="mt-1 rounded-md border border-[hsl(0,0%,17%)] bg-[hsl(0,0%,8%)]">
            <pre className="p-2 text-[11px] font-mono leading-[1.5] text-foreground/50 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {step.detail}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentActionStep;
