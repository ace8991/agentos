import { useMemo, useState } from 'react';
import {
  AlertTriangle, Brain, Check, ChevronDown, ChevronRight,
  Copy, Eye, FileText, FolderOpen, Globe,
  MessageCircleQuestion, Search, Sparkles, Terminal, Zap,
} from 'lucide-react';
import { type LogEntry } from '@/store/useStore';
import { parseArtifacts } from '@/lib/artifacts';
import ArtifactCard from './ArtifactCard';

const TOOL: Record<string, { label: string; Icon: typeof Eye; color: string }> = {
  file_read:       { label: 'Reading',     Icon: FileText,   color: 'text-amber-400/70'   },
  file_write:      { label: 'Writing',     Icon: FileText,   color: 'text-amber-400/70'   },
  file_edit:       { label: 'Editing',     Icon: FileText,   color: 'text-amber-400/70'   },
  file_list:       { label: 'Listing',     Icon: FolderOpen, color: 'text-amber-400/70'   },
  file_search:     { label: 'Searching',   Icon: Search,     color: 'text-amber-400/70'   },
  file_create_dir: { label: 'Creating',    Icon: FolderOpen, color: 'text-amber-400/70'   },
  file_move:       { label: 'Moving',      Icon: FolderOpen, color: 'text-amber-400/70'   },
  file_info:       { label: 'Reading',     Icon: FileText,   color: 'text-amber-400/70'   },
  dc_shell:        { label: 'Running',     Icon: Terminal,   color: 'text-green-400/70'   },
  shell:           { label: 'Running',     Icon: Terminal,   color: 'text-green-400/70'   },
  browser:         { label: 'Browsing',    Icon: Globe,      color: 'text-sky-400/70'     },
  web:             { label: 'Searching',   Icon: Search,     color: 'text-sky-400/70'     },
  perceive:        { label: 'Analyzing',   Icon: Eye,        color: 'text-purple-400/70'  },
  plan:            { label: 'Planning',    Icon: Brain,      color: 'text-purple-400/70'  },
  act:             { label: 'Executing',   Icon: Zap,        color: 'text-orange-400/70'  },
  verify:          { label: 'Verifying',   Icon: Check,      color: 'text-emerald-400/70' },
  thinking:        { label: 'Thinking',    Icon: Brain,      color: 'text-purple-400/70'  },
};

function toolCfg(e: LogEntry) {
  const at = e.actionType || '', t = e.type as string;
  return TOOL[at] || TOOL[t] || (at.startsWith('file') ? TOOL.file_read : null)
    || { label: e.toolLabel || t, Icon: Zap, color: 'text-foreground/30' };
}

const STEPS = new Set(['perceive','plan','act','verify','browser','web','shell','file','thinking']);
const isStep = (e: LogEntry) =>
  STEPS.has(e.type as string) || (e.actionType||'').startsWith('file') || e.actionType === 'dc_shell';

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1800); }}
      className="p-1 text-foreground/25 hover:text-foreground/60 transition-colors">
      {ok ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
    </button>
  );
}

function IL(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return <>{parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-semibold text-foreground/96">{p.slice(2,-2)}</strong>;
    if (/^\*[^*]+\*$/.test(p))     return <em key={i} className="italic text-foreground/72">{p.slice(1,-1)}</em>;
    if (/^`[^`]+`$/.test(p))       return <code key={i} className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[12.5px] font-mono text-foreground/85">{p.slice(1,-1)}</code>;
    const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (m) return <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-foreground/60 hover:text-foreground">{m[1]}</a>;
    return <span key={i}>{p}</span>;
  })}</>;
}

function Md({ text }: { text: string }) {
  if (!text?.trim()) return null;
  const blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  return (
    <div className="space-y-3">
      {blocks.map((block, bi) => {
        if (block.startsWith('```')) {
          const lines = block.split('\n');
          const lang = lines[0].slice(3).trim();
          const end = lines.lastIndexOf('```');
          const code = lines.slice(1, end > 0 ? end : undefined).join('\n');
          return (
            <div key={bi} className="rounded-xl overflow-hidden border border-white/[0.07] bg-black/25">
              <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/[0.05] bg-white/[0.02]">
                <span className="text-[11px] text-foreground/35 font-mono">{lang || 'code'}</span>
                <CopyBtn text={code} />
              </div>
              <pre className="p-4 text-[12.5px] font-mono text-foreground/78 leading-[1.65] overflow-x-auto whitespace-pre-wrap">{code}</pre>
            </div>
          );
        }
        if (block.startsWith('### ')) return <h3 key={bi} className="text-[13.5px] font-semibold text-foreground/90 mt-1">{IL(block.slice(4))}</h3>;
        if (block.startsWith('## '))  return <h2 key={bi} className="text-[15px] font-semibold text-foreground/95 mt-1">{IL(block.slice(3))}</h2>;
        if (block.startsWith('# '))   return <h1 key={bi} className="text-[17px] font-bold text-foreground">{IL(block.slice(2))}</h1>;
        if (/^[-*]{3,}$/.test(block)) return <hr key={bi} className="border-white/[0.08]" />;
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length && lines.every(l => /^[-*+]\s/.test(l)))
          return <ul key={bi} className="space-y-1.5 pl-0.5">{lines.map((l,i) => (
            <li key={i} className="flex items-start gap-2.5 text-foreground/83 text-[15px]">
              <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/25"/>
              <span className="leading-7">{IL(l.replace(/^[-*+]\s/,''))}</span>
            </li>))}</ul>;
        if (lines.length && lines.every(l => /^\d+[.)]\s/.test(l)))
          return <ol key={bi} className="space-y-1.5 pl-0.5">{lines.map((l,i) => (
            <li key={i} className="flex items-start gap-2.5 text-foreground/83 text-[15px]">
              <span className="shrink-0 font-mono text-[12px] text-foreground/30 mt-1.5 w-5 text-right">{i+1}.</span>
              <span className="leading-7">{IL(l.replace(/^\d+[.)]\s/,''))}</span>
            </li>))}</ol>;
        return <p key={bi} className="text-[15px] text-foreground/85 leading-7">{IL(block)}</p>;
      })}
    </div>
  );
}

function ToolStep({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false);
  const cfg = toolCfg(entry);
  const { Icon } = cfg;
  const label = useMemo(() => {
    const r = entry.tool_result as any;
    const tl = entry.toolLabel || '';
    const desc = r?.description || '';
    const path = r?.path || '';
    const cmd  = r?.command || '';
    const act  = String(entry.action || '').slice(0, 80);
    if (tl) return tl;
    if (desc) return desc.slice(0, 80);
    if (path) return `${cfg.label} · ${path.split(/[\\/]/).pop()}`;
    if (cmd)  return `${cfg.label} · ${cmd.slice(0, 55)}`;
    return act || cfg.label;
  }, [entry, cfg]);
  const detail = useMemo(() => {
    const r = entry.tool_result as any;
    if (!r) return '';
    if (typeof r.stdout === 'string' && r.stdout.trim())
      return `$ ${r.command||''}\n\n${r.stdout.trim()}${r.stderr?'\nSTDERR:\n'+r.stderr:''}`.slice(0,1200);
    if (typeof r.content === 'string' && r.content.trim())
      return r.content.trim().slice(0,1000);
    if (Array.isArray(r.items))
      return r.items.slice(0,15).map((i:any)=>
        `${i.type==='directory'?'📁':'📄'} ${i.name}${i.size_bytes?` (${Math.round(i.size_bytes/1024)}KB)`:''}`
      ).join('\n');
    if (Array.isArray(r.results))
      return r.results.slice(0,8).map((i:any)=>i.path||i.name||String(i)).join('\n');
    return '';
  }, [entry]);
  const isErr = (entry.tool_result as any)?.exit_code > 0 || entry.type === 'error';
  return (
    <div className="flex items-start gap-2.5 py-0.5 group">
      <div className={`mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm ${isErr?'bg-red-500/10':'bg-white/[0.04]'}`}>
        <Icon size={11} className={isErr?'text-red-400/70':cfg.color} />
      </div>
      <div className="flex-1 min-w-0">
        <button onClick={()=>detail&&setOpen(o=>!o)}
          className={`flex w-full items-center gap-1.5 text-left ${detail?'cursor-pointer':'cursor-default'}`}>
          <span className="text-[13px] text-foreground/45 leading-5 truncate">{label}</span>
          {detail && (open
            ? <ChevronDown size={12} className="shrink-0 text-foreground/30"/>
            : <ChevronRight size={12} className="shrink-0 text-foreground/20 group-hover:text-foreground/35 transition-colors"/>
          )}
        </button>
        {open && detail && (
          <div className="mt-1.5 rounded-lg border border-white/[0.07] bg-black/20">
            <pre className="p-3 text-[11.5px] font-mono leading-5 text-foreground/52 whitespace-pre-wrap max-h-52 overflow-y-auto">{detail}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingStep({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-start gap-2.5 py-0.5">
      <div className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm bg-purple-500/10">
        <Brain size={11} className="text-purple-400/70" />
      </div>
      <div className="flex-1">
        <button onClick={()=>entry.reasoning&&setOpen(o=>!o)}
          className={`flex items-center gap-1.5 ${entry.reasoning?'cursor-pointer':'cursor-default'}`}>
          <span className="text-[13px] italic text-foreground/30">Thinking…</span>
          {entry.reasoning && (open
            ? <ChevronDown size={12} className="text-foreground/25"/>
            : <ChevronRight size={12} className="text-foreground/18"/>)}
        </button>
        {open && entry.reasoning && (
          <div className="mt-1.5 rounded-lg border border-purple-500/15 bg-purple-500/5 px-4 py-3">
            <p className="text-[12px] italic leading-5 text-foreground/38 whitespace-pre-wrap">{entry.reasoning}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const ChatMessage = ({ entry, onAskReply }: { entry: LogEntry; onAskReply?: (id:string,a:string)=>void }) => {
  const [askInput, setAskInput] = useState('');
  const isResult = entry.type === 'result';
  const { text: txt, artifacts: arts } = isResult
    ? parseArtifacts(entry.action)
    : { text: entry.action, artifacts: [] };
  const artifacts = arts.filter(a => a.type !== 'terminal');

  // User bubble
  if (entry.type === 'info' && entry.step === 0) return (
    <div className="flex justify-end px-4 pb-2 pt-1 log-entry-enter">
      <div className="max-w-[82%] rounded-[20px] rounded-br-[5px] bg-[hsl(var(--muted))] px-4 py-2.5">
        <p className="text-[15px] text-foreground/90 leading-[1.55] whitespace-pre-wrap">{entry.action}</p>
      </div>
    </div>
  );

  // Thinking
  if (entry.type === 'thinking') return (
    <div className="px-4 pb-0.5 log-entry-enter"><ThinkingStep entry={entry} /></div>
  );

  // Tool step (compact + collapsible — Claude style)
  if (isStep(entry)) return (
    <div className="px-4 pb-0.5 log-entry-enter"><ToolStep entry={entry} /></div>
  );

  // Error
  if (entry.type === 'error') return (
    <div className="px-4 py-2 log-entry-enter">
      <div className="flex items-start gap-2.5 rounded-xl border border-red-500/15 bg-red-500/5 px-4 py-3">
        <AlertTriangle size={13} className="text-red-400/80 shrink-0 mt-0.5" />
        <p className="text-[13.5px] text-red-300/80 leading-[1.5]">{entry.action}</p>
      </div>
    </div>
  );

  // Ask
  if (entry.type === 'ask') return (
    <div className="px-4 py-3 log-entry-enter">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--surface-elevated))]">
          <MessageCircleQuestion size={14} className="text-foreground/55" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] text-foreground/85 leading-7 mb-3">{entry.action}</p>
          {!entry.askResolved && (
            entry.askOptions?.length
              ? <div className="flex flex-wrap gap-2">{entry.askOptions.map((o,i)=>(
                  <button key={i} onClick={()=>onAskReply?.(entry.id,o)}
                    className="rounded-[14px] border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-foreground/72 hover:bg-white/[0.08] hover:text-foreground transition-colors active:scale-[0.97]">
                    {o}
                  </button>))}</div>
              : <div className="flex gap-2">
                  <input value={askInput} onChange={e=>setAskInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter'&&askInput.trim()){onAskReply?.(entry.id,askInput);setAskInput('');}}}
                    placeholder="Votre réponse…"
                    className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-white/[0.18]"/>
                  <button onClick={()=>{if(askInput.trim()){onAskReply?.(entry.id,askInput);setAskInput('');}}}
                    className="rounded-xl bg-white/[0.08] px-3 py-2 text-[13px] text-foreground/70 hover:bg-white/[0.12]">
                    Envoyer
                  </button>
                </div>
          )}
        </div>
      </div>
    </div>
  );

  // AI response — Claude style
  const responseText = isResult ? txt : entry.action;
  if (!responseText?.trim() && !artifacts.length) return null;
  return (
    <div className="px-4 pb-3 pt-2 log-entry-enter">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--surface-elevated))]">
          <Sparkles size={14} className="text-foreground/50" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          {responseText && <Md text={responseText} />}
          {artifacts.length > 0 && (
            <div className="mt-4 space-y-2">{artifacts.map(a=><ArtifactCard key={a.id} artifact={a}/>)}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
