import { useState } from 'react';
import { ChevronDown, FolderOpen, Plus, Sparkles, ArrowRight, Check, Circle, Download, Wrench, CalendarClock, FileCode2 } from 'lucide-react';
import TaskSidebar from '@/components/TaskSidebar';

interface FileCard {
  path: string;
  type: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  done: boolean;
}

const sampleFiles: FileCard[] = [
  { path: 'src/components/ChatPanel.tsx', type: 'TSX' },
  { path: 'src/pages/Welcome.tsx', type: 'TSX' },
  { path: 'src/store/useStore.ts', type: 'TS' },
  { path: 'src/lib/api.ts', type: 'TS' },
  { path: 'backend/app/services/brain.py', type: 'PY' },
];

const defaultChecklist: ChecklistItem[] = [
  {
    id: 'download',
    label: 'Télécharger Cowork',
    description: 'Bienvenue ! Cowork est prêt à l\'emploi.',
    done: true,
  },
  {
    id: 'connect-tools',
    label: 'Connectez vos outils quotidiens',
    description: 'Plus l\'agent connaît votre configuration, plus il peut en faire.',
    done: false,
  },
  {
    id: 'create-something',
    label: 'Demandez à l\'agent de créer quelque chose',
    description: 'Essayez un tableur, un document ou une présentation.',
    done: false,
  },
  {
    id: 'schedule-task',
    label: 'Planifier une tâche récurrente',
    description: 'Idéal pour les rappels, rapports ou suivis réguliers.',
    done: false,
  },
];

const CoworkPage = () => {
  const [input, setInput] = useState('');
  const [checklist, setChecklist] = useState(defaultChecklist);

  const toggleItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const checklistIcons: Record<string, typeof Download> = {
    download: Download,
    'connect-tools': Wrench,
    'create-something': FileCode2,
    'schedule-task': CalendarClock,
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <TaskSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="flex-1 flex flex-col items-center px-4 py-8 sm:px-8 sm:py-12">
          {/* Hero */}
          <div className="text-center mb-6 max-w-[680px] w-full">
            <div className="flex items-center justify-center gap-2.5 mb-2">
              <Sparkles size={24} className="text-accent" />
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Accomplissons une tâche de votre liste
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cowork est en aperçu. <a href="#" className="text-foreground/70 underline">Découvrez comment l'utiliser.</a>
            </p>
          </div>

          {/* File cards strip */}
          <div className="flex gap-2.5 w-full max-w-[740px] overflow-x-auto pb-2 mb-5 scrollbar-thin">
            {sampleFiles.map((file) => (
              <button
                key={file.path}
                className="flex-shrink-0 min-w-[115px] max-w-[140px] rounded-lg border border-white/10 bg-[hsl(var(--surface))] p-2.5 text-left hover:bg-[hsl(var(--surface-elevated))] transition-colors"
              >
                <p className="text-[10px] text-muted-foreground leading-snug break-all mb-2">
                  {file.path}
                </p>
                <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                  {file.type}
                </span>
              </button>
            ))}
          </div>

          {/* Input box */}
          <div className="w-full max-w-[680px] rounded-xl border border-white/10 bg-[hsl(var(--surface))] p-3.5 mb-6">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Que souhaitez-vous accomplir ?"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between mt-3 gap-2">
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <FolderOpen size={14} />
                <span className="truncate">Travailler dans un projet</span>
                <ChevronDown size={12} />
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button className="p-1 text-muted-foreground hover:text-foreground">
                  <Plus size={16} />
                </button>
                <button className="flex items-center gap-1 text-xs text-muted-foreground">
                  Sonnet 4.6 <ChevronDown size={12} />
                </button>
                <button className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent/90 transition-colors">
                  C'est parti
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Discover checklist */}
          <div className="w-full max-w-[680px]">
            <h2 className="text-sm font-semibold text-foreground/80 mb-3">Découvrez Cowork.</h2>
            <div className="space-y-0">
              {checklist.map((item) => {
                const Icon = checklistIcons[item.id] || Circle;
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 py-3 border-b border-white/5 last:border-b-0 cursor-pointer"
                    onClick={() => toggleItem(item.id)}
                  >
                    <div
                      className={`mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                        item.done
                          ? 'bg-muted-foreground/60 border-muted-foreground/60'
                          : 'border-white/20'
                      }`}
                    >
                      {item.done && <Check size={11} className="text-background" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium transition-colors ${
                          item.done ? 'text-muted-foreground line-through' : 'text-foreground/90'
                        }`}
                      >
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    <Icon size={15} className="text-muted-foreground mt-1 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoworkPage;
