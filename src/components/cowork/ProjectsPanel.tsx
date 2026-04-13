import { useState } from 'react';
import { FolderOpen, Plus, ChevronRight, FileText, MoreHorizontal } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  files: number;
  updatedAt: string;
}

const ProjectsPanel = () => {
  const [projects, setProjects] = useState<Project[]>([
    { id: '1', name: 'Mon Application Web', description: 'Application React avec dashboard', files: 12, updatedAt: 'Il y a 2h' },
    { id: '2', name: 'API Backend', description: 'API FastAPI pour le projet principal', files: 8, updatedAt: 'Hier' },
    { id: '3', name: 'Documentation', description: 'Documentation technique du projet', files: 5, updatedAt: 'Il y a 3 jours' },
  ]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const createProject = () => {
    if (!newName.trim()) return;
    setProjects(prev => [...prev, {
      id: Date.now().toString(),
      name: newName,
      description: newDesc,
      files: 0,
      updatedAt: "À l'instant",
    }]);
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
  };

  return (
    <div className="max-w-[680px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Projets</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(14,74%,52%)] text-white text-xs font-medium hover:bg-[hsl(14,74%,42%)] transition-colors"
        >
          <Plus size={13} /> Nouveau projet
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 p-4 rounded-xl bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,20%)] space-y-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom du projet"
            className="w-full bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,20%)] rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optionnel)"
            className="w-full bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,20%)] rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="flex gap-2">
            <button onClick={createProject} className="px-3 py-1.5 rounded-lg bg-[hsl(14,74%,52%)] text-white text-xs font-medium hover:bg-[hsl(14,74%,42%)] transition-colors">
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
            className="flex items-center gap-3 p-3.5 rounded-xl bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,18%)] hover:bg-[hsl(0,0%,16%)] hover:border-[hsl(14,74%,52%)]/20 cursor-pointer transition-all group"
          >
            <div className="h-9 w-9 rounded-lg bg-[hsl(0,0%,20%)] flex items-center justify-center flex-shrink-0">
              <FolderOpen size={16} className="text-[hsl(14,74%,52%)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{project.description}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-1 text-muted-foreground">
                <FileText size={11} />
                <span className="text-[11px]">{project.files}</span>
              </div>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">{project.updatedAt}</span>
              <ChevronRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectsPanel;
