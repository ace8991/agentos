import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  FolderOpen,
  Github,
  Search,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  FileCode2,
  Clock,
  ChevronRight,
  MessageSquare,
  ArrowLeft,
} from 'lucide-react';
import {
  loadProjects,
  createProject,
  removeProject,
  getCurrentProject,
  setCurrentProjectId,
  type AppProject,
} from '@/lib/projects';

/* ───────────────────────────────────────────
   Types
   ─────────────────────────────────────────── */

interface CodeSidebarProps {
  onSelectProject: (project: AppProject) => void;
  activeProject: AppProject | null;
}

/* ───────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────── */

const getProjectEmoji = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('react')) return '⚛️';
  if (lower.includes('python') || lower.includes('py')) return '🐍';
  if (lower.includes('vue')) return '💚';
  if (lower.includes('angular')) return '🔴';
  if (lower.includes('node') || lower.includes('js')) return '🟢';
  if (lower.includes('rust')) return '🦀';
  if (lower.includes('go') || lower.includes('golang')) return '🔵';
  if (lower.includes('docker')) return '🐳';
  if (lower.includes('api')) return '🔌';
  if (lower.includes('web') || lower.includes('site')) return '🌐';
  if (lower.includes('mobile') || lower.includes('app')) return '📱';
  if (lower.includes('game')) return '🎮';
  if (lower.includes('ai') || lower.includes('ml')) return '🤖';
  if (lower.includes('data')) return '📊';
  if (lower.includes('blog')) return '📝';
  if (lower.includes('doc')) return '📄';
  if (lower.includes('test')) return '🧪';
  if (lower.includes('cli') || lower.includes('tool')) return '🔧';
  return '📁';
};

const getRelativeDate = (date: Date) => {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

/* ───────────────────────────────────────────
   CodeSidebar Component
   ─────────────────────────────────────────── */

const CodeSidebar = ({ onSelectProject, activeProject }: CodeSidebarProps) => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'projects' | 'new'>('projects');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New project form state
  const [newProjectType, setNewProjectType] = useState<'local' | 'github' | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const refreshProjects = useCallback(() => {
    setProjects(loadProjects());
  }, []);

  useEffect(() => {
    refreshProjects();
    const handler = () => refreshProjects();
    window.addEventListener('agentos-projects-updated', handler);
    return () => window.removeEventListener('agentos-projects-updated', handler);
  }, [refreshProjects]);

  const filtered = search.trim()
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase()),
      )
    : projects;

  const handleSelectProject = (project: AppProject) => {
    setCurrentProjectId(project.id);
    onSelectProject(project);
  };

  const handleDeleteProject = (projectId: string) => {
    if (confirmDelete === projectId) {
      removeProject(projectId);
      setConfirmDelete(null);
      refreshProjects();
      if (activeProject?.id === projectId) {
        setCurrentProjectId(null);
      }
    } else {
      setConfirmDelete(projectId);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const handleCopyId = (projectId: string) => {
    navigator.clipboard.writeText(projectId);
    setCopiedId(projectId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateProject = async () => {
    if (newProjectType === 'local') {
      if (!newName.trim()) {
        setCreateError('Veuillez entrer un nom de projet');
        return;
      }
      setCreating(true);
      setCreateError('');
      try {
        const project = createProject({ name: newName.trim(), description: newDescription.trim() });
        refreshProjects();
        setNewName('');
        setNewDescription('');
        setNewProjectType(null);
        setTab('projects');
        handleSelectProject(project);
      } catch {
        setCreateError('Erreur lors de la création du projet');
      } finally {
        setCreating(false);
      }
    } else if (newProjectType === 'github') {
      if (!githubUrl.trim()) {
        setCreateError('Veuillez entrer une URL GitHub');
        return;
      }
      setCreating(true);
      setCreateError('');
      try {
        const repoName = githubUrl.trim().split('/').pop()?.replace('.git', '') || 'GitHub Project';
        const project = createProject({ name: repoName, description: `Importé depuis ${githubUrl.trim()}` });
        refreshProjects();
        setGithubUrl('');
        setNewProjectType(null);
        setTab('projects');
        handleSelectProject(project);
      } catch {
        setCreateError("Erreur lors de l'import du projet");
      } finally {
        setCreating(false);
      }
    }
  };

  const resetNewForm = () => {
    setNewProjectType(null);
    setNewName('');
    setNewDescription('');
    setGithubUrl('');
    setCreateError('');
  };

  /* ─── Collapsed state ─── */
  if (collapsed) {
    return (
      <div className="w-[52px] flex-shrink-0 bg-[hsl(0,0%,10%)] border-r border-[hsl(0,0%,17%)] flex flex-col items-center py-3 gap-3">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-[hsl(0,0%,15%)]"
          title="Ouvrir le menu"
        >
          <PanelLeftOpen size={16} />
        </button>
        <button
          onClick={() => { setTab('new'); setCollapsed(false); }}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-[hsl(0,0%,15%)]"
          title="Nouveau projet"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => { setTab('projects'); setCollapsed(false); }}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-[hsl(0,0%,15%)]"
          title="Projets"
        >
          <FolderOpen size={16} />
        </button>
      </div>
    );
  }

  /* ─── Full sidebar ─── */
  return (
    <div className="w-[280px] flex-shrink-0 bg-[hsl(0,0%,10%)] border-r border-[hsl(0,0%,17%)] flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(0,0%,17%)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-[hsl(0,0%,15%)]"
            aria-label="Retour"
          >
            <ArrowLeft size={16} />
            <span className="text-xs">Retour</span>
          </button>
          <FileCode2 size={16} className="text-primary-400 ml-1" />
          <span className="text-sm font-semibold text-foreground/90">Code</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-[hsl(0,0%,15%)]"
          title="Réduire"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-3 pt-2.5 pb-1 gap-1">
        <button
          onClick={() => { setTab('projects'); resetNewForm(); }}
          className={`flex-1 text-center text-xs font-medium py-1.5 rounded-md transition-colors ${
            tab === 'projects'
              ? 'bg-[hsl(0,0%,18%)] text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,14%)]'
          }`}
        >
          Projets
        </button>
        <button
          onClick={() => setTab('new')}
          className={`flex-1 text-center text-xs font-medium py-1.5 rounded-md transition-colors ${
            tab === 'new'
              ? 'bg-[hsl(0,0%,18%)] text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(0,0%,14%)]'
          }`}
        >
          Nouveau
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {tab === 'projects' && (
          <div className="px-2 py-2 space-y-1">
            {/* Search */}
            {projects.length > 0 && (
              <div className="relative mb-2 px-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full h-8 pl-7 pr-2 text-xs bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,20%)] rounded-md text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary-500/40 transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {filtered.length > 0 ? (
              filtered.map((project) => {
                const isActive = activeProject?.id === project.id;
                const isDeleting = confirmDelete === project.id;
                return (
                  <div key={project.id} className="group relative">
                    <button
                      onClick={() => handleSelectProject(project)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                        isActive
                          ? 'bg-primary-500/10 text-primary-200'
                          : 'text-foreground/80 hover:bg-[hsl(0,0%,15%)]'
                      }`}
                    >
                      <span className="text-base flex-shrink-0">{getProjectEmoji(project.name)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isActive ? 'text-primary-200' : 'text-foreground/90'}`}>
                          {project.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground/60 truncate flex items-center gap-1">
                          <Clock size={10} />
                          {getRelativeDate(new Date(project.updatedAt))}
                        </p>
                      </div>
                      {isActive && (
                        <span className="text-[10px] font-medium text-primary-400 bg-primary-500/15 px-1.5 py-0.5 rounded-full">
                          Actif
                        </span>
                      )}
                    </button>

                    {/* Context menu buttons */}
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyId(project.id); }}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
                        title="Copier l'ID"
                      >
                        {copiedId === project.id ? <Check size={12} className="text-primary-400" /> : <Copy size={12} />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                        className={`p-1 transition-colors rounded ${
                          isDeleting ? 'text-destructive bg-destructive/15' : 'text-muted-foreground hover:text-destructive'
                        }`}
                        title={isDeleting ? 'Confirmer la suppression' : 'Supprimer'}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="h-12 w-12 rounded-xl bg-[hsl(0,0%,14%)] flex items-center justify-center mb-3">
                  <FolderOpen size={22} className="text-muted-foreground/60" />
                </div>
                <p className="text-sm text-foreground/70 font-medium mb-1">
                  {search ? 'Aucun résultat' : 'Aucun projet'}
                </p>
                <p className="text-xs text-muted-foreground/60 mb-4 max-w-[180px]">
                  {search
                    ? 'Essayez un autre terme de recherche'
                    : 'Créez votre premier projet pour commencer'}
                </p>
                {!search && (
                  <button
                    onClick={() => setTab('new')}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    <Plus size={13} />
                    Nouveau projet
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'new' && (
          <div className="px-4 py-4 space-y-4">
            {!newProjectType ? (
              <>
                <p className="text-xs text-muted-foreground/70">Choisissez le type de projet</p>
                <button
                  onClick={() => setNewProjectType('local')}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,20%)] hover:bg-[hsl(0,0%,16%)] transition-colors text-left group"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary-500/10 flex items-center justify-center group-hover:bg-primary-500/15 transition-colors">
                    <Plus size={18} className="text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground/90">Projet local</p>
                    <p className="text-[11px] text-muted-foreground/60">Créez un projet sur votre machine</p>
                  </div>
                  <ChevronRight size={15} className="ml-auto text-muted-foreground/40" />
                </button>
                <button
                  onClick={() => setNewProjectType('github')}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,20%)] hover:bg-[hsl(0,0%,16%)] transition-colors text-left group"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary-500/10 flex items-center justify-center group-hover:bg-primary-500/15 transition-colors">
                    <Github size={18} className="text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground/90">Depuis GitHub</p>
                    <p className="text-[11px] text-muted-foreground/60">Importez un dépôt existant</p>
                  </div>
                  <ChevronRight size={15} className="ml-auto text-muted-foreground/40" />
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={resetNewForm}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-[hsl(0,0%,15%)]"
                  >
                    <X size={14} />
                  </button>
                  <p className="text-xs font-medium text-foreground/70">
                    {newProjectType === 'local' ? 'Nouveau projet local' : 'Importer depuis GitHub'}
                  </p>
                </div>

                {newProjectType === 'local' && (
                  <>
                    <div>
                      <label className="text-[11px] text-muted-foreground/60 mb-1.5 block">Nom du projet</label>
                      <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Mon projet"
                        className="w-full h-9 px-3 text-sm bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,20%)] rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary-500/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground/60 mb-1.5 block">Description (optionnelle)</label>
                      <textarea
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Description du projet..."
                        rows={3}
                        className="w-full px-3 py-2 text-sm bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,20%)] rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary-500/40 transition-colors resize-none"
                      />
                    </div>
                  </>
                )}

                {newProjectType === 'github' && (
                  <div>
                    <label className="text-[11px] text-muted-foreground/60 mb-1.5 block">URL du dépôt GitHub</label>
                    <input
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/user/repo"
                      className="w-full h-9 px-3 text-sm bg-[hsl(0,0%,14%)] border border-[hsl(0,0%,20%)] rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary-500/40 transition-colors"
                    />
                  </div>
                )}

                {createError && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 px-2.5 py-1.5 rounded-md">
                    <AlertCircle size={12} />
                    {createError}
                  </div>
                )}

                <button
                  onClick={handleCreateProject}
                  disabled={creating}
                  className="w-full flex items-center justify-center gap-2 h-9 text-sm font-medium rounded-md bg-primary-500/20 text-primary-300 border border-primary-500/20 hover:bg-primary-500/30 transition-colors disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : newProjectType === 'local' ? (
                    <Plus size={14} />
                  ) : (
                    <Github size={14} />
                  )}
                  {creating
                    ? 'Création...'
                    : newProjectType === 'local'
                    ? 'Créer le projet'
                    : 'Importer le dépôt'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 border-t border-[hsl(0,0%,17%)]">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <MessageSquare size={12} className="text-muted-foreground/60" />
            <span className="text-[11px] text-muted-foreground/60">
              {projects.length} projet{projects.length !== 1 ? 's' : ''}
            </span>
          </div>
          {activeProject && (
            <span className="text-[11px] text-primary-400/70 truncate max-w-[120px]">
              {activeProject.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export { CodeSidebar };
