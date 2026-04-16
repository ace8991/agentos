import { useMemo, useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, Brain, Check, ChevronDown, ChevronRight,
  Copy, Eye, FileText, FolderOpen, Globe, Loader2,
  MessageCircleQuestion, Search, Sparkles, Terminal, Zap,
  Clock, Hash,
} from 'lucide-react';
import { type LogEntry } from '@/store/useStore';
import { parseArtifacts } from '@/lib/artifacts';
import ArtifactCard from './ArtifactCard';

/* ── Tool config ── */
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

/* ── Syntax highlighting (lightweight inline) ── */
const SYNTAX_RULES: Record<string, Array<[RegExp, string]>> = {
  javascript: [
    [/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await|new|typeof|instanceof|try|catch|throw|switch|case|break|continue|yield|delete|in|of|void)\b/g, 'text-purple-400'],
    [/\b(true|false|null|undefined|NaN|Infinity)\b/g, 'text-orange-400'],
    [/\b(\d+\.?\d*)\b/g, 'text-amber-300'],
    [/(\/\/.*$)/gm, 'text-foreground/30 italic'],
    [/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, 'text-green-400'],
    [/\b(console|window|document|Math|JSON|Array|Object|String|Number|Promise|Map|Set)\b/g, 'text-sky-400'],
  ],
  typescript: [], // filled below
  python: [
    [/\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|raise|yield|lambda|pass|break|continue|global|nonlocal|assert|del|in|not|and|or|is)\b/g, 'text-purple-400'],
    [/\b(True|False|None)\b/g, 'text-orange-400'],
    [/\b(\d+\.?\d*)\b/g, 'text-amber-300'],
    [/(#.*$)/gm, 'text-foreground/30 italic'],
    [/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|"""[\s\S]*?"""|'''[\s\S]*?''')/g, 'text-green-400'],
    [/\b(print|len|range|list|dict|set|tuple|int|float|str|bool|type|isinstance|enumerate|zip|map|filter|sorted|super|self)\b/g, 'text-sky-400'],
  ],
  html: [
    [/(<\/?[\w-]+)/g, 'text-red-400'],
    [/([\w-]+)(?==)/g, 'text-amber-300'],
    [/("(?:[^"\\]|\\.)*")/g, 'text-green-400'],
    [/(<!--[\s\S]*?-->)/g, 'text-foreground/30 italic'],
  ],
  css: [
    [/([.#][\w-]+)/g, 'text-amber-300'],
    [/([\w-]+)(?=\s*:)/g, 'text-sky-400'],
    [/(\/\*[\s\S]*?\*\/)/g, 'text-foreground/30 italic'],
    [/(\b\d+\.?\d*(px|rem|em|%|vh|vw|s|ms)?\b)/g, 'text-orange-400'],
  ],
  sql: [
    [/\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|IS|NULL|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|SET|VALUES|INTO|DISTINCT|UNION|EXISTS|BETWEEN|LIKE|CASE|WHEN|THEN|ELSE|END|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|DEFAULT|CHECK|UNIQUE)\b/gi, 'text-purple-400'],
    [/('(?:[^'\\]|\\.)*')/g, 'text-green-400'],
    [/(--.*$)/gm, 'text-foreground/30 italic'],
    [/\b(\d+\.?\d*)\b/g, 'text-amber-300'],
  ],
  json: [
    [/("(?:[^"\\]|\\.)*")\s*:/g, 'text-sky-400'],
    [/:\s*("(?:[^"\\]|\\.)*")/g, 'text-green-400'],
    [/\b(true|false|null)\b/g, 'text-orange-400'],
    [/\b(\d+\.?\d*)\b/g, 'text-amber-300'],
  ],
  bash: [
    [/\b(if|then|else|elif|fi|for|do|done|while|case|esac|function|return|exit|export|source|alias|cd|echo|sudo|chmod|chown|mkdir|rm|cp|mv|ls|cat|grep|sed|awk|find|curl|wget|npm|yarn|pip|git|docker)\b/g, 'text-purple-400'],
    [/(#.*$)/gm, 'text-foreground/30 italic'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, 'text-green-400'],
    [/(\$[\w{]+}?)/g, 'text-amber-300'],
  ],
};
SYNTAX_RULES.typescript = SYNTAX_RULES.javascript;
SYNTAX_RULES.jsx = SYNTAX_RULES.javascript;
SYNTAX_RULES.tsx = SYNTAX_RULES.javascript;
SYNTAX_RULES.js = SYNTAX_RULES.javascript;
SYNTAX_RULES.ts = SYNTAX_RULES.javascript;
SYNTAX_RULES.sh = SYNTAX_RULES.bash;
SYNTAX_RULES.shell = SYNTAX_RULES.bash;
SYNTAX_RULES.powershell = SYNTAX_RULES.bash;
SYNTAX_RULES.py = SYNTAX_RULES.python;

function highlightCode(code: string, lang: string): React.ReactNode[] {
  const rules = SYNTAX_RULES[lang.toLowerCase()];
  if (!rules || !rules.length) {
    return [<span key="0">{code}</span>];
  }

  // Simple line-by-line approach
  return code.split('\n').map((line, li) => {
    let segments: Array<{ text: string; cls?: string }> = [{ text: line }];

    for (const [regex, cls] of rules) {
      const next: typeof segments = [];
      for (const seg of segments) {
        if (seg.cls) { next.push(seg); continue; }
        const r = new RegExp(regex.source, regex.flags);
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = r.exec(seg.text)) !== null) {
          if (m.index > last) next.push({ text: seg.text.slice(last, m.index) });
          next.push({ text: m[1] || m[0], cls });
          last = m.index + m[0].length;
          if (!regex.global) break;
        }
        if (last < seg.text.length) next.push({ text: seg.text.slice(last) });
        if (last === 0 && next[next.length - 1] !== seg) next.push(seg);
      }
      segments = next;
    }

    return (
      <span key={li}>
        {segments.map((s, si) =>
          s.cls ? <span key={si} className={s.cls}>{s.text}</span> : <span key={si}>{s.text}</span>
        )}
        {li < code.split('\n').length - 1 ? '\n' : ''}
      </span>
    );
  });
}

/* ── Copy button ── */
function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1800); }}
      className="p-1 text-foreground/25 hover:text-foreground/60 transition-colors">
      {ok ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
    </button>
  );
}

/* ── Inline Markdown ── */
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

/* ── Markdown renderer with tables, blockquotes, syntax highlighting ── */
function Md({ text }: { text: string }) {
  if (!text?.trim()) return null;

  // Split into blocks but handle code blocks as atomic units
  const rawBlocks: string[] = [];
  let current = '';
  let inCode = false;

  for (const line of text.split('\n')) {
    if (line.trimStart().startsWith('```') && !inCode) {
      if (current.trim()) rawBlocks.push(current.trim());
      current = line + '\n';
      inCode = true;
    } else if (line.trimStart().startsWith('```') && inCode) {
      current += line;
      rawBlocks.push(current.trim());
      current = '';
      inCode = false;
    } else if (inCode) {
      current += line + '\n';
    } else {
      current += line + '\n';
    }
  }
  if (current.trim()) rawBlocks.push(current.trim());

  // Now split non-code blocks by double newlines
  const blocks: string[] = [];
  for (const raw of rawBlocks) {
    if (raw.startsWith('```')) {
      blocks.push(raw);
    } else {
      raw.split(/\n{2,}/).map(b => b.trim()).filter(Boolean).forEach(b => blocks.push(b));
    }
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, bi) => {
        // Code block with syntax highlighting
        if (block.startsWith('```')) {
          const lines = block.split('\n');
          const lang = lines[0].slice(3).trim();
          const end = lines.lastIndexOf('```');
          const code = lines.slice(1, end > 0 ? end : undefined).join('\n');
          const lineCount = code.split('\n').length;
          return (
            <div key={bi} className="rounded-xl overflow-hidden border border-white/[0.07] bg-black/25">
              <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/[0.05] bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-foreground/35 font-mono">{lang || 'code'}</span>
                  <span className="text-[10px] text-foreground/20 font-mono">{lineCount} lines</span>
                </div>
                <CopyBtn text={code} />
              </div>
              <div className="flex">
                {/* Line numbers */}
                <div className="select-none py-4 pl-3 pr-2 text-right border-r border-white/[0.04]">
                  {code.split('\n').map((_, i) => (
                    <div key={i} className="text-[11px] font-mono text-foreground/15 leading-[1.65]">{i + 1}</div>
                  ))}
                </div>
                <pre className="flex-1 p-4 text-[12.5px] font-mono leading-[1.65] overflow-x-auto whitespace-pre-wrap">
                  <code>{highlightCode(code, lang)}</code>
                </pre>
              </div>
            </div>
          );
        }

        // Blockquote
        if (block.split('\n').every(l => l.startsWith('> ') || l === '>')) {
          const content = block.split('\n').map(l => l.replace(/^>\s?/, '')).join('\n');
          return (
            <blockquote key={bi} className="border-l-2 border-foreground/15 pl-4 py-1 text-[14.5px] text-foreground/60 italic leading-7">
              {IL(content)}
            </blockquote>
          );
        }

        // Table
        if (block.includes('|') && block.split('\n').length >= 2) {
          const tableLines = block.split('\n').filter(l => l.trim().startsWith('|'));
          if (tableLines.length >= 2) {
            const parseRow = (line: string) =>
              line.split('|').slice(1, -1).map(c => c.trim());
            const headerRow = parseRow(tableLines[0]);
            // Check if second line is separator
            const isSep = /^[\s|:-]+$/.test(tableLines[1]);
            const dataRows = tableLines.slice(isSep ? 2 : 1).map(parseRow);

            if (headerRow.length > 0 && (isSep || dataRows.length > 0)) {
              return (
                <div key={bi} className="overflow-x-auto rounded-lg border border-white/[0.07]">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-white/[0.1] bg-white/[0.03]">
                        {headerRow.map((h, i) => (
                          <th key={i} className="px-3 py-2 text-left font-semibold text-foreground/70">{IL(h)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dataRows.map((row, ri) => (
                        <tr key={ri} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-2 text-foreground/65">{IL(cell)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
          }
        }

        // Headers
        if (block.startsWith('#### ')) return <h4 key={bi} className="text-[13px] font-semibold text-foreground/85 mt-1">{IL(block.slice(5))}</h4>;
        if (block.startsWith('### ')) return <h3 key={bi} className="text-[13.5px] font-semibold text-foreground/90 mt-1">{IL(block.slice(4))}</h3>;
        if (block.startsWith('## '))  return <h2 key={bi} className="text-[15px] font-semibold text-foreground/95 mt-1">{IL(block.slice(3))}</h2>;
        if (block.startsWith('# '))   return <h1 key={bi} className="text-[17px] font-bold text-foreground">{IL(block.slice(2))}</h1>;
        if (/^[-*]{3,}$/.test(block)) return <hr key={bi} className="border-white/[0.08]" />;

        // Lists
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

/* ── Tool Step with timing & spinner ── */
function ToolStep({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const cfg = toolCfg(entry);
  const { Icon } = cfg;

  const isRunning = !entry.tool_result && entry.type !== 'error';
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (!isRunning) return;
    const iv = setInterval(() => setElapsed(Date.now() - startTime.current), 100);
    return () => clearInterval(iv);
  }, [isRunning]);

  const duration = useMemo(() => {
    if (isRunning) return `${(elapsed / 1000).toFixed(1)}s`;
    const tr = entry.tool_result as any;
    if (tr?.duration_ms) return `${(tr.duration_ms / 1000).toFixed(1)}s`;
    if (tr?.completed_at && tr?.started_at) {
      const d = new Date(tr.completed_at).getTime() - new Date(tr.started_at).getTime();
      return `${(d / 1000).toFixed(1)}s`;
    }
    return null;
  }, [isRunning, elapsed, entry.tool_result]);

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

  // Structured params display
  const params = useMemo(() => {
    const r = entry.tool_result as any;
    if (!r) return null;
    const p: Record<string, string> = {};
    if (r.path) p['path'] = r.path;
    if (r.command) p['cmd'] = r.command.slice(0, 60);
    if (r.url) p['url'] = r.url.slice(0, 60);
    if (r.query) p['query'] = r.query.slice(0, 40);
    return Object.keys(p).length > 0 ? p : null;
  }, [entry]);

  const isErr = (entry.tool_result as any)?.exit_code > 0 || entry.type === 'error';

  return (
    <div className="flex items-start gap-2.5 py-0.5 group">
      <div className={`mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm ${isErr?'bg-red-500/10':'bg-white/[0.04]'}`}>
        {isRunning ? (
          <Loader2 size={11} className={`${cfg.color} animate-spin`} />
        ) : (
          <Icon size={11} className={isErr?'text-red-400/70':cfg.color} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <button onClick={()=>detail&&setOpen(o=>!o)}
          className={`flex w-full items-center gap-1.5 text-left ${detail?'cursor-pointer':'cursor-default'}`}>
          <span className="text-[13px] text-foreground/45 leading-5 truncate">{label}</span>
          {duration && (
            <span className="flex items-center gap-0.5 text-[10px] text-foreground/20 font-mono shrink-0">
              <Clock size={8} />
              {duration}
            </span>
          )}
          {detail && (open
            ? <ChevronDown size={12} className="shrink-0 text-foreground/30"/>
            : <ChevronRight size={12} className="shrink-0 text-foreground/20 group-hover:text-foreground/35 transition-colors"/>
          )}
        </button>
        {/* Structured params */}
        {params && !open && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {Object.entries(params).map(([k, v]) => (
              <span key={k} className="text-[10.5px] text-foreground/20 font-mono truncate max-w-[240px]">
                {k}=<span className="text-foreground/30">{v}</span>
              </span>
            ))}
          </div>
        )}
        {open && detail && (
          <div className="mt-1.5 rounded-lg border border-white/[0.07] bg-black/20">
            <pre className="p-3 text-[11.5px] font-mono leading-5 text-foreground/52 whitespace-pre-wrap max-h-52 overflow-y-auto">{detail}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Extended Thinking with budget + token count ── */
function ThinkingStep({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false);
  const tokenCount = useMemo(() => {
    if (!entry.reasoning) return 0;
    // Rough estimate: ~4 chars per token
    return Math.ceil(entry.reasoning.length / 4);
  }, [entry.reasoning]);

  const budgetLabel = useMemo(() => {
    if (tokenCount > 2000) return 'Extended';
    if (tokenCount > 500) return 'Deep';
    return 'Quick';
  }, [tokenCount]);

  return (
    <div className="flex items-start gap-2.5 py-0.5">
      <div className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm bg-purple-500/10">
        <Brain size={11} className="text-purple-400/70" />
      </div>
      <div className="flex-1">
        <button onClick={()=>entry.reasoning&&setOpen(o=>!o)}
          className={`flex items-center gap-1.5 ${entry.reasoning?'cursor-pointer':'cursor-default'}`}>
          <span className="text-[13px] italic text-foreground/30">
            {entry.reasoning ? `${budgetLabel} Thinking` : 'Thinking…'}
          </span>
          {tokenCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-purple-400/30 font-mono">
              <Hash size={8} />
              ~{tokenCount} tokens
            </span>
          )}
          {entry.reasoning && (open
            ? <ChevronDown size={12} className="text-foreground/25"/>
            : <ChevronRight size={12} className="text-foreground/18"/>)}
        </button>
        {open && entry.reasoning && (
          <div className="mt-1.5 rounded-lg border border-purple-500/15 bg-purple-500/5 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-purple-400/40 font-mono uppercase tracking-wider">
                {budgetLabel} Thinking · ~{tokenCount} tokens
              </span>
              <CopyBtn text={entry.reasoning} />
            </div>
            <p className="text-[12px] italic leading-5 text-foreground/38 whitespace-pre-wrap">{entry.reasoning}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main ChatMessage ── */
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

  // Tool step
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

  // AI response
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
