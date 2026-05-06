import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  Code2,
  MonitorPlay,
  FolderOpen,
  Database,
  Loader2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileCode,
  Eye,
  Layers3,
  ChevronRight,
  ChevronDown,
  File,
  FileText,
  Image,
  Braces,
  Terminal,
  Globe,
  Box,
  Bot,
  TerminalSquare,
  FilePlus2,
} from 'lucide-react';
import { generateProject, getProjectStatus, type GeneratedWorkspace, type GeneratedWorkspaceFile, type ProjectGenerateEvent } from '@/lib/api';

/* ─── Types ─────────────────────────────────────────── */

type GenerationPhase = 'idle' | 'analyzing' | 'generating' | 'parsing' | 'complete' | 'error';

interface PhaseMessage {
  phase: GenerationPhase;
  label: string;
  icon: typeof Loader2;
}

const PHASES: PhaseMessage[] = [
  { phase: 'analyzing', label: 'Analyse de votre demande…', icon: Loader2 },
  { phase: 'generating', label: 'Génération du projet…', icon: Loader2 },
  { phase: 'parsing', label: 'Organisation des fichiers…', icon: Loader2 },
];

/* ─── Helpers ───────────────────────────────────────── */

function iconForFile(file: GeneratedWorkspaceFile) {
  const ext = file.path.split('.').pop()?.toLowerCase();
  const name = file.path.split('/').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif'].includes(ext ?? '')) return Image;
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext ?? '')) return Braces;
  if (['html', 'htm'].includes(ext ?? '')) return Globe;
  if (['css', 'scss', 'less'].includes(ext ?? '')) return FileText;
  if (['json', 'yaml', 'yml', 'toml'].includes(ext ?? '')) return Braces;
  if (['py', 'rb', 'go', 'rs', 'java', 'kt'].includes(ext ?? '')) return Terminal;
  if (['md', 'txt', 'doc'].includes(ext ?? '')) return FileText;
  if (name.startsWith('docker') || name === 'Dockerfile') return Box;
  return FileCode;
}

function groupLabel(group: string): string {
  switch (group) {
    case 'source': return 'Source';
    case 'config': return 'Configuration';
    case 'public': return 'Public';
    case 'styles': return 'Styles';
    case 'data': return 'Données';
    default: return group.charAt(0).toUpperCase() + group.slice(1);
  }
}

/* ─── Props ─────────────────────────────────────────── */

interface ProjectGeneratorPanelProps {
  open: boolean;
  onClose: () => void;
  onWorkspaceReady: (workspace: GeneratedWorkspace) => void;
  initialPrompt?: string;
  autoStart?: boolean;
}

/* ─── Component ─────────────────────────────────────── */

const ProjectGeneratorPanel = ({ open, onClose, onWorkspaceReady, initialPrompt, autoStart }: ProjectGeneratorPanelProps) => {
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<GeneratedWorkspace | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['source']));
  const [progressMessage, setProgressMessage] = useState('');
  const [filesCreated, setFilesCreated] = useState(0);
  const [toolCalls, setToolCalls] = useState<{ tool: string; status: 'running' | 'done' | 'error'; label: string }[]>([]);
  const [llmText, setLlmText] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const autoStartedRef = useRef<string | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Auto-scroll tool log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [toolCalls, llmText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async (overridePrompt?: string) => {
    const effectivePrompt = (overridePrompt ?? prompt).trim();
    if (!effectivePrompt) return;
    if (overridePrompt) setPrompt(overridePrompt);

    setPhase('analyzing');
    setError(null);
    setWorkspace(null);
    setProgressMessage('');
    setFilesCreated(0);
    setToolCalls([]);
    setLlmText('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Phase 1: Analyzing
      setProgressMessage('Analyse de votre demande…');
      await new Promise((r) => setTimeout(r, 600));

      setPhase('generating');
      setProgressMessage('Génération du projet via agentic loop…');

      const result = await generateProject(
        { prompt: prompt.trim() },
        (event: ProjectGenerateEvent) => {
          if (controller.signal.aborted) return;

          switch (event.type) {
            case 'phase':
              setProgressMessage(event.message ?? '');
              if (event.phase === 'parsing') setPhase('parsing');
              if (event.phase === 'complete') setPhase('complete');
              break;

            case 'text':
              setLlmText((prev) => {
                const next = prev + (event.text ?? '');
                // Keep only last ~500 chars for display
                return next.length > 2000 ? '…' + next.slice(-1997) : next;
              });
              break;

            case 'tool_call':
              setToolCalls((prev) => [
                ...prev,
                {
                  tool: event.tool ?? 'unknown',
                  status: 'running',
                  label: toolLabel(event.tool ?? '', event.args ?? {}),
                },
              ]);
              break;

            case 'tool_result':
              setToolCalls((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0 && next[lastIdx].status === 'running') {
                  next[lastIdx] = {
                    ...next[lastIdx],
                    status: event.success ? 'done' : 'error',
                  };
                }
                return next;
              });
              break;

            case 'file_created':
              setFilesCreated(event.total ?? 0);
              break;
          }
        },
        controller.signal,
      );

      if (controller.signal.aborted) return;

      setPhase('parsing');
      setProgressMessage('Organisation des fichiers…');
      await new Promise((r) => setTimeout(r, 400));

      setPhase('complete');
      setWorkspace(result);
      setProgressMessage('Projet généré avec succès !');
      onWorkspaceReady(result);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setProgressMessage('Échec de la génération');
    }
  }, [prompt, onWorkspaceReady]);

  const handleRegenerate = useCallback(() => {
    setPhase('idle');
    setError(null);
    setWorkspace(null);
    setProgressMessage('');
    setFilesCreated(0);
    setToolCalls([]);
    setLlmText('');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Auto-start generation when an initialPrompt is provided
  useEffect(() => {
    if (!open) {
      autoStartedRef.current = null;
      return;
    }
    if (!autoStart || !initialPrompt) return;
    if (autoStartedRef.current === initialPrompt) return;
    autoStartedRef.current = initialPrompt;
    setPrompt(initialPrompt);
    // Defer to next tick so prompt state is committed before generate reads it
    setTimeout(() => {
      // Inline-start: bypass the prompt-state read by calling generate via state
      handleGenerate();
    }, 50);
  }, [open, autoStart, initialPrompt, handleGenerate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate],
  );

  const filesByGroup = workspace
    ? workspace.files.reduce<Record<string, GeneratedWorkspaceFile[]>>((acc, file) => {
        const g = file.group || 'source';
        if (!acc[g]) acc[g] = [];
        acc[g].push(file);
        return acc;
      }, {})
    : {};

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="mx-auto mb-4 w-full max-w-[980px] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.18)]"
        >
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-300/14 bg-primary-400/8 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-primary-100/78">
              <Sparkles size={12} />
              Project Generator
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>

          {/* Input area (idle or error) */}
          {(phase === 'idle' || phase === 'error') && (
            <div className="space-y-3">
              <textarea
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Décrivez le projet à générer… ex: « un jeu snake en HTML5 Canvas », « un dashboard analytics avec Chart.js », « une landing page moderne avec animations »"
                rows={3}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary-300/30 focus:outline-none focus:ring-1 focus:ring-primary-300/20"
              />

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground/60">
                  Appuyez sur <kbd className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> pour générer
                </p>
                <button
                  onClick={() => handleGenerate()}
                  disabled={!prompt.trim()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary-300/18 bg-primary-400/10 px-4 py-2 text-sm font-medium text-primary-100 transition-colors hover:bg-primary-400/15 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles size={14} />
                  Générer le projet
                </button>
              </div>
            </div>
          )}

          {/* Progress phases */}
          {(phase === 'analyzing' || phase === 'generating' || phase === 'parsing') && (
            <div className="space-y-4 py-4">
              {PHASES.map((p) => {
                const currentPhase = phase as string;
                const isActive = currentPhase === p.phase;
                const isDone =
                  (p.phase === 'analyzing' && (currentPhase === 'generating' || currentPhase === 'parsing' || currentPhase === 'complete')) ||
                  (p.phase === 'generating' && (currentPhase === 'parsing' || currentPhase === 'complete')) ||
                  (p.phase === 'parsing' && currentPhase === 'complete');

                return (
                  <div key={p.phase} className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isDone
                          ? 'bg-success/20 text-success'
                          : isActive
                            ? 'bg-primary-400/15 text-primary-100'
                            : 'bg-white/[0.04] text-muted-foreground/40'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle size={16} />
                      ) : isActive ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-current" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          isDone
                            ? 'text-success'
                            : isActive
                              ? 'text-foreground'
                              : 'text-muted-foreground/40'
                        }`}
                      >
                        {p.label}
                      </p>
                      {isActive && progressMessage && (
                        <p className="mt-0.5 text-xs text-muted-foreground/70">{progressMessage}</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Live agentic log (visible during generating phase) */}
              {phase === 'generating' && (
                <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 max-h-[260px] overflow-y-auto scrollbar-thin">
                  {/* LLM text streaming */}
                  {llmText && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground/80">
                      <Bot size={12} className="mt-0.5 shrink-0 text-primary-100/60" />
                      <span className="italic leading-relaxed">{llmText}</span>
                    </div>
                  )}

                  {/* Tool calls log */}
                  {toolCalls.map((tc, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {tc.status === 'running' ? (
                        <Loader2 size={12} className="shrink-0 animate-spin text-primary-100/60" />
                      ) : tc.status === 'done' ? (
                        <CheckCircle size={12} className="shrink-0 text-success/70" />
                      ) : (
                        <AlertTriangle size={12} className="shrink-0 text-destructive/70" />
                      )}
                      <span
                        className={
                          tc.status === 'running'
                            ? 'text-muted-foreground/80'
                            : tc.status === 'done'
                              ? 'text-muted-foreground/60'
                              : 'text-destructive/80'
                        }
                      >
                        {tc.label}
                      </span>
                    </div>
                  ))}

                  {/* Files created counter */}
                  {filesCreated > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                      <FilePlus2 size={12} className="shrink-0" />
                      <span>{filesCreated} fichier{filesCreated > 1 ? 's' : ''} créé{filesCreated > 1 ? 's' : ''}</span>
                    </div>
                  )}

                  <div ref={logEndRef} />
                </div>
              )}
            </div>
          )}

          {/* Complete — show generated project */}
          {phase === 'complete' && workspace && (
            <div className="space-y-4">
              {/* Success banner */}
              <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 px-3 py-2">
                <CheckCircle size={16} className="text-success" />
                <span className="text-sm font-medium text-success">Projet généré avec succès</span>
              </div>

              {/* Project info */}
              <div className="space-y-1">
                <h3 className="text-lg font-semibold tracking-tight text-white">{workspace.title}</h3>
                <p className="text-sm leading-relaxed text-white/62">{workspace.summary}</p>
                {workspace.stack && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {workspace.stack.frontend && (
                      <span className="rounded-full border border-primary-300/14 bg-primary-400/8 px-2.5 py-0.5 text-[10px] font-medium text-primary-100/78">
                        {workspace.stack.frontend}
                      </span>
                    )}
                    {workspace.stack.backend && (
                      <span className="rounded-full border border-primary-300/14 bg-primary-400/8 px-2.5 py-0.5 text-[10px] font-medium text-primary-100/78">
                        {workspace.stack.backend}
                      </span>
                    )}
                    {workspace.stack.database && (
                      <span className="rounded-full border border-primary-300/14 bg-primary-400/8 px-2.5 py-0.5 text-[10px] font-medium text-primary-100/78">
                        {workspace.stack.database}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* File tree */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground/70">Fichiers générés ({workspace.files.length})</p>
                <div className="max-h-[240px] overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-2 scrollbar-thin">
                  {Object.entries(filesByGroup).map(([group, files]) => {
                    const isExpanded = expandedGroups.has(group);
                    const Icon = isExpanded ? ChevronDown : ChevronRight;
                    return (
                      <div key={group}>
                        <button
                          onClick={() => toggleGroup(group)}
                          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
                        >
                          <Icon size={12} />
                          <FolderOpen size={12} />
                          {groupLabel(group)}
                          <span className="ml-auto text-[10px] text-muted-foreground/50">{files.length}</span>
                        </button>
                        {isExpanded && (
                          <div className="ml-4 space-y-0.5">
                            {files.map((file) => {
                              const FileIcon = iconForFile(file);
                              return (
                                <div
                                  key={file.path}
                                  className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-muted-foreground/80 transition-colors hover:bg-white/[0.03] hover:text-foreground"
                                >
                                  <FileIcon size={12} className="shrink-0 text-muted-foreground/50" />
                                  <span className="truncate">{file.path}</span>
                                  {file.language && (
                                    <span className="ml-auto shrink-0 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground/50">
                                      {file.language}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onWorkspaceReady(workspace)}
                  className="inline-flex items-center gap-2 rounded-full border border-primary-300/18 bg-primary-400/10 px-4 py-2 text-sm font-medium text-primary-100 transition-colors hover:bg-primary-400/15"
                >
                  <MonitorPlay size={14} />
                  Preview
                </button>
                <button
                  onClick={() => onWorkspaceReady(workspace)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <Code2 size={14} />
                  Code
                </button>
                {workspace.database_files.length > 0 && (
                  <button
                    onClick={() => onWorkspaceReady(workspace)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                  >
                    <Database size={14} />
                    Database
                  </button>
                )}
                <button
                  onClick={() => onWorkspaceReady(workspace)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  <FolderOpen size={14} />
                  Files
                </button>
                <button
                  onClick={handleRegenerate}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
                >
                  <RefreshCw size={12} />
                  Nouvelle génération
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function toolLabel(tool: string, args: Record<string, unknown>): string {
  switch (tool) {
    case 'str_replace_editor': {
      const cmd = args.command as string;
      const path = (args.path as string) ?? '';
      const fileName = path.split('/').pop() ?? path.split('\\').pop() ?? path;
      if (cmd === 'create') return `📄 Création de ${fileName}`;
      if (cmd === 'edit') return `✏️ Modification de ${fileName}`;
      if (cmd === 'view') return `👁️ Lecture de ${fileName}`;
      return `📁 ${fileName}`;
    }
    case 'bash_tool': {
      const cmd = (args.command as string) ?? '';
      const short = cmd.length > 50 ? cmd.slice(0, 50) + '…' : cmd;
      return `💻 ${short}`;
    }
    case 'list_directory':
      return `📂 Liste: ${(args.path as string) ?? ''}`;
    case 'web_search':
      return `🌐 Recherche: ${(args.query as string) ?? ''}`;
    case 'system_info':
      return `🖥️ Info système`;
    default:
      return `🔧 ${tool}`;
  }
}

export default ProjectGeneratorPanel;
