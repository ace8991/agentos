import { useState } from 'react';
import {
  CalendarClock, Plus, Play, Pause, Trash2, Clock, CheckCircle2,
  AlertCircle, ChevronDown, X, Send, Loader2
} from 'lucide-react';
import { useCoworkStore } from '@/store/coworkStore';

interface ScheduledTask {
  id: string;
  name: string;
  schedule: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  lastRun?: string;
  nextRun?: string;
  description: string;
}

const sampleTasks: ScheduledTask[] = [
  {
    id: '1',
    name: 'Rapport hebdomadaire',
    schedule: 'Tous les lundis à 9h',
    status: 'active',
    lastRun: 'Lun. 31 mars, 09:00',
    nextRun: 'Lun. 7 avril, 09:00',
    description: 'Générer un résumé des activités de la semaine',
  },
  {
    id: '2',
    name: 'Vérification des dépendances',
    schedule: 'Tous les jours à 6h',
    status: 'active',
    lastRun: "Aujourd'hui, 06:00",
    nextRun: 'Demain, 06:00',
    description: 'Scanner les vulnérabilités npm et mettre à jour',
  },
  {
    id: '3',
    name: 'Backup base de données',
    schedule: 'Tous les dimanches à 2h',
    status: 'paused',
    lastRun: 'Dim. 30 mars, 02:00',
    description: 'Sauvegarder toutes les tables en CSV',
  },
];

const schedulePresets = [
  'Toutes les heures',
  'Tous les jours à 6h',
  'Tous les jours à 9h',
  'Tous les jours à 18h',
  'Tous les lundis à 9h',
  'Tous les vendredis à 17h',
  'Tous les dimanches à 2h',
  'Toutes les 30 minutes',
];

const statusConfig = {
  active: { icon: Play, color: 'text-[hsl(140,60%,50%)]', bg: 'bg-[hsl(140,60%,50%)]/10', label: 'Actif' },
  paused: { icon: Pause, color: 'text-accent-foreground', bg: 'bg-accent/10', label: 'Pausé' },
  completed: { icon: CheckCircle2, color: 'text-primary', bg: 'bg-primary/10', label: 'Terminé' },
  error: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Erreur' },
};

interface DispatchPanelProps {
  onSendTask?: (task: string) => void;
}

const DispatchPanel = ({ onSendTask }: DispatchPanelProps) => {
  const [tasks, setTasks] = useState(sampleTasks);
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', description: '', schedule: '' });
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [quickTask, setQuickTask] = useState('');
  const { dispatchExecutions, addDispatchExecution, updateDispatchExecution } = useCoworkStore();

  const toggleStatus = (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: t.status === 'active' ? 'paused' : 'active' } as ScheduledTask : t
      )
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const createTask = () => {
    if (!newTask.name.trim()) return;
    const schedule = newTask.schedule || 'Tous les jours à 9h';
    setTasks((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: newTask.name,
        schedule,
        status: 'active' as const,
        nextRun: 'Demain, 09:00',
        description: newTask.description || 'Tâche personnalisée',
      },
    ]);
    setNewTask({ name: '', description: '', schedule: '' });
    setShowCreate(false);
  };

  const handleQuickDispatch = () => {
    if (!quickTask.trim()) return;
    const execId = crypto.randomUUID();
    addDispatchExecution({
      id: execId,
      taskId: execId,
      taskName: quickTask,
      status: 'running',
      startedAt: new Date().toISOString(),
    });
    // Simulate completion
    setTimeout(() => {
      updateDispatchExecution(execId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        result: 'Tâche exécutée avec succès.',
      });
    }, 3000 + Math.random() * 4000);
    if (onSendTask) onSendTask(quickTask);
    setQuickTask('');
  };

  return (
    <div className="w-full max-w-[680px] mx-auto">
      {/* Quick dispatch */}
      <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
          <Send size={14} className="text-primary" />
          Envoyer une tâche à l'agent
        </h3>
        <p className="text-[11px] text-muted-foreground mb-3">
          Décrivez ce que vous souhaitez accomplir. L'agent exécutera la tâche en arrière-plan.
        </p>
        <div className="flex gap-2">
          <input
            value={quickTask}
            onChange={(e) => setQuickTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickDispatch()}
            placeholder="Ex: Compile un rapport des ventes du mois..."
            className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
          />
          <button
            onClick={handleQuickDispatch}
            disabled={!quickTask.trim()}
            className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            <Send size={12} /> Envoyer
          </button>
        </div>
      </div>

      {/* Execution history */}
      {dispatchExecutions.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-foreground mb-3">Exécutions récentes</h3>
          <div className="space-y-2">
            {dispatchExecutions.map((exec) => (
              <div key={exec.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[hsl(var(--surface))] border border-border">
                {exec.status === 'running' ? (
                  <Loader2 size={14} className="text-primary animate-spin flex-shrink-0" />
                ) : exec.status === 'completed' ? (
                  <CheckCircle2 size={14} className="text-[hsl(140,60%,50%)] flex-shrink-0" />
                ) : (
                  <AlertCircle size={14} className="text-destructive flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground truncate">{exec.taskName}</p>
                  {exec.result && <p className="text-[11px] text-muted-foreground truncate">{exec.result}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {exec.status === 'running' ? 'En cours...' : 'Terminé'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled tasks header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={18} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Tâches planifiées</h2>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={13} /> Nouvelle tâche
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 rounded-xl border border-border bg-[hsl(var(--surface))] p-4 space-y-3">
          <input
            value={newTask.name}
            onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
            placeholder="Nom de la tâche"
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
          />
          <input
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            placeholder="Description"
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
          />
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowSchedulePicker(!showSchedulePicker)}
                className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 border border-border transition-colors"
              >
                <Clock size={12} />
                {newTask.schedule || 'Planifier'}
                <ChevronDown size={11} />
              </button>
              {showSchedulePicker && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-[hsl(var(--surface))] border border-border rounded-xl shadow-xl overflow-hidden min-w-[220px]">
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                    <span className="text-[11px] font-medium text-foreground">Fréquence</span>
                    <button onClick={() => setShowSchedulePicker(false)} className="text-muted-foreground hover:text-foreground">
                      <X size={12} />
                    </button>
                  </div>
                  <div className="py-1 max-h-[200px] overflow-y-auto">
                    {schedulePresets.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          setNewTask({ ...newTask, schedule: preset });
                          setShowSchedulePicker(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          newTask.schedule === preset
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground/80 hover:bg-muted'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div className="px-3 py-2 border-t border-border">
                    <input
                      value={newTask.schedule}
                      onChange={(e) => setNewTask({ ...newTask, schedule: e.target.value })}
                      placeholder="Ou saisissez un cron..."
                      className="w-full bg-muted/30 border border-border rounded-md px-2 py-1.5 text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <button onClick={() => { setShowCreate(false); setShowSchedulePicker(false); }} className="px-3 py-2 text-xs rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                Annuler
              </button>
              <button onClick={createTask} disabled={!newTask.name.trim()} className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors">
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {tasks.map((task) => {
          const config = statusConfig[task.status];
          const StatusIcon = config.icon;
          return (
            <div key={task.id} className="rounded-xl border border-border bg-[hsl(var(--surface))] p-3.5 hover:bg-[hsl(var(--surface-elevated))] transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{task.name}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full ${config.bg} ${config.color}`}>
                      <StatusIcon size={10} /> {config.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {task.schedule}
                    </span>
                    {task.lastRun && <span>Dernier: {task.lastRun}</span>}
                    {task.nextRun && <span className="text-primary">Prochain: {task.nextRun}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleStatus(task.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                    title={task.status === 'active' ? 'Pauser' : 'Reprendre'}
                  >
                    {task.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && (
          <div className="text-center py-8">
            <CalendarClock size={28} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Aucune tâche planifiée</p>
            <button onClick={() => setShowCreate(true)} className="mt-3 text-xs text-primary hover:underline">
              Créer votre première tâche
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DispatchPanel;
