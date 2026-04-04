import { useState } from 'react';
import { CalendarClock, Plus, Play, Pause, Trash2, Clock, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';

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
    lastRun: 'Aujourd\'hui, 06:00',
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

const statusConfig = {
  active: { icon: Play, color: 'text-success', bg: 'bg-success/10', label: 'Actif' },
  paused: { icon: Pause, color: 'text-accent', bg: 'bg-accent/10', label: 'Pausé' },
  completed: { icon: CheckCircle2, color: 'text-primary', bg: 'bg-primary/10', label: 'Terminé' },
  error: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Erreur' },
};

const DispatchPanel = () => {
  const [tasks, setTasks] = useState(sampleTasks);
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', description: '', schedule: '' });

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
    setTasks((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        ...newTask,
        schedule: newTask.schedule || 'Tous les jours à 9h',
        status: 'active' as const,
        nextRun: 'Demain, 09:00',
        description: newTask.description || 'Tâche personnalisée',
      },
    ]);
    setNewTask({ name: '', description: '', schedule: '' });
    setShowCreate(false);
  };

  return (
    <div className="w-full max-w-[680px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={18} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Dispatch – Tâches planifiées</h2>
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
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <input
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            placeholder="Description"
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 border border-border">
              <Clock size={12} />
              Planifier
              <ChevronDown size={11} />
            </button>
            <div className="flex-1" />
            <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-xs rounded-lg text-muted-foreground hover:text-foreground">
              Annuler
            </button>
            <button onClick={createTask} className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
              Créer
            </button>
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
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground truncate">{task.name}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full ${config.bg} ${config.color}`}>
                      <StatusIcon size={10} /> {config.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
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
          </div>
        )}
      </div>
    </div>
  );
};

export default DispatchPanel;
