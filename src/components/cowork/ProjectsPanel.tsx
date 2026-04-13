import { useState } from 'react';
import {
  FolderOpen, Plus, ChevronRight, FileText, ArrowLeft, Trash2,
  Settings, Brain, ListChecks, CheckCircle2, Circle, Loader2, X, Upload
} from 'lucide-react';
import { useCoworkStore, type CoworkProject } from '@/store/coworkStore';

interface ProjectsPanelProps {
  onOpenChat?: (projectId: string) => void;
}

const ProjectsPanel = ({ onOpenChat }: ProjectsPanelProps) => {
  const { projects, createProject, updateProject, deleteProject, addProjectFile, removeProjectFile, addProjectTask, updateProjectTaskStatus } = useCoworkStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionsDraft, setInstructionsDraft] = useState('');

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createProject(newName, newDesc);
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
  };

  const handleAddFile = () => {
    if (!activeProject) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      Array.from(files).forEach((f) => {
        addProjectFile(activeProject.id, {
          id: crypto.randomUUID(),
          name: f.name,
          path: f.name,
          type: f.type || f.name.split('.').pop() || 'file',
          size: f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${(f.size / 1024).toFixed(1)} KB`,
        });
      });
    };
    input.click();
  };

  const taskStatusIcons = {
    todo: Circle,
    in_progress: Loader2,
    done: CheckCircle2,
  };

  // Detail view
  if (activeProject) {
    return (
      <div className="max-w-[720px] mx-auto">
        <button
          onClick={() => setActiveProjectId(null)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> Retour aux projets
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{activeProject.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{activeProject.description}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenChat && (
              <button
                onClick={() => onOpenChat(activeProject.id)}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                Ouvrir dans Cowork
              </button>
            )}
            <button
              onClick={() => deleteProject(activeProject.id)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Settings size={14} className="text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Instructions</h3>
            <button
              onClick={() => {
                if (editingInstructions) {
                  updateProject(activeProject.id, { instructions: instructionsDraft });
                  setEditingInstructions(false);
                } else {
                  setInstructionsDraft(activeProject.instructions);
                  setEditingInstructions(true);
                }
              }}
              className="text-[11px] text-primary hover:underline ml-auto"
            >
              {editingInstructions ? 'Sauvegarder' : 'Modifier'}
            </button>
          </div>
          {editingInstructions ? (
            <textarea
              value={instructionsDraft}
              onChange={(e) => setInstructionsDraft(e.target.value)}
              placeholder="Instructions personnalisées pour l'agent dans le contexte de ce projet..."
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground min-h-[80px] resize-y focus:border-primary/50 transition-colors"
            />
          ) : (
            <p className="text-[13px] text-foreground/70 bg-muted/20 rounded-lg px-3 py-2 min-h-[40px]">
              {activeProject.instructions || 'Aucune instruction. Cliquez sur "Modifier" pour en ajouter.'}
            </p>
          )}
        </div>

        {/* Memory */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Brain size={14} className="text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Mémoire du projet</h3>
          </div>
          <div className="bg-muted/20 rounded-lg px-3 py-2 min-h-[40px]">
            {activeProject.memory.length > 0 ? (
              <ul className="text-[13px] text-foreground/70 space-y-1">
                {activeProject.memory.map((m, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-primary flex-shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted-foreground">La mémoire se remplira automatiquement au fil des conversations.</p>
            )}
          </div>
        </div>

        {/* Files */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Fichiers ({activeProject.files.length})</h3>
            </div>
            <button
              onClick={handleAddFile}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <Upload size={11} /> Ajouter
            </button>
          </div>
          <div className="space-y-1.5">
            {activeProject.files.map((f) => (
              <div key={f.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[hsl(var(--surface))] border border-border group">
                <FileText size={13} className="text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground truncate">{f.name}</p>
                  {f.size && <p className="text-[10px] text-muted-foreground">{f.size}</p>}
                </div>
                <button
                  onClick={() => removeProjectFile(activeProject.id, f.id)}
                  className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {activeProject.files.length === 0 && (
              <p className="text-[13px] text-muted-foreground py-3 text-center">Aucun fichier. Glissez ou ajoutez des fichiers.</p>
            )}
          </div>
        </div>

        {/* Tasks */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ListChecks size={14} className="text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Tâches</h3>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTaskTitle.trim()) {
                  addProjectTask(activeProject.id, newTaskTitle);
                  setNewTaskTitle('');
                }
              }}
              placeholder="Ajouter une tâche..."
              className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
            />
            <button
              onClick={() => {
                if (newTaskTitle.trim()) {
                  addProjectTask(activeProject.id, newTaskTitle);
                  setNewTaskTitle('');
                }
              }}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1.5">
            {activeProject.tasks.map((task) => {
              const Icon = taskStatusIcons[task.status];
              return (
                <div key={task.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[hsl(var(--surface))] border border-border">
                  <button
                    onClick={() => {
                      const nextStatus = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo';
                      updateProjectTaskStatus(activeProject.id, task.id, nextStatus);
                    }}
                    className="flex-shrink-0"
                  >
                    <Icon
                      size={14}
                      className={`${
                        task.status === 'done' ? 'text-[hsl(140,60%,50%)]' : task.status === 'in_progress' ? 'text-primary animate-spin' : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                  <span className={`text-[13px] flex-1 ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {task.title}
                  </span>
                </div>
              );
            })}
            {activeProject.tasks.length === 0 && (
              <p className="text-[13px] text-muted-foreground py-2 text-center">Aucune tâche pour ce projet.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="max-w-[680px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Projets</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={13} /> Nouveau projet
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 p-4 rounded-xl bg-[hsl(var(--surface))] border border-border space-y-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom du projet"
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optionnel)"
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
              Créer
            </button>
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 rounded-lg text-muted-foreground text-xs hover:text-foreground transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => setActiveProjectId(project.id)}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-[hsl(var(--surface))] border border-border hover:bg-[hsl(var(--surface-elevated))] hover:border-primary/20 cursor-pointer transition-all group"
          >
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <FolderOpen size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{project.description}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-1 text-muted-foreground">
                <FileText size={11} />
                <span className="text-[11px]">{project.files.length}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <ListChecks size={11} />
                <span className="text-[11px]">{project.tasks.length}</span>
              </div>
              <ChevronRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="text-center py-10">
            <FolderOpen size={32} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Aucun projet. Créez votre premier projet pour organiser vos tâches.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsPanel;
