import { Suspense, lazy, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Search, Settings, SlidersHorizontal, BookOpen, Bot, FolderPlus,
  Share2, ChevronRight, Plug, Globe, PanelLeftClose, PanelLeftOpen,
  BarChart3, Clock, Trash2, Menu, X
} from 'lucide-react';
import { useStore, type HistoryRun } from '@/store/useStore';
import HexLogo from './HexLogo';
import SidebarModeSwitch from './sidebar/SidebarModeSwitch';
import SidebarToolStatus from './sidebar/SidebarToolStatus';
import { getCurrentProject, loadProjects, PROJECTS_UPDATED_EVENT, type AppProject } from '@/lib/projects';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/components/ui/sonner';

const ProjectsModal = lazy(() => import('./projects/ProjectsModal'));

const statusDot: Record<string, string> = {
  done: 'bg-success',
  error: 'bg-destructive',
  running: 'bg-primary status-dot-running',
  idle: 'bg-muted-foreground',
  paused: 'bg-accent',
};

const TaskSidebar = () => {
  const history = useStore((s) => s.history);
  const reset = useStore((s) => s.reset);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const openSettingsFor = useStore((s) => s.openSettingsFor);
  const setViewingHistory = useStore((s) => s.setViewingHistory);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projects, setProjects] = useState<AppProject[]>(() => loadProjects());
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const currentProject = projects.find((project) => project.id === currentProjectId) || getCurrentProject(projects);

  useEffect(() => {
    const syncProjects = () => setProjects(loadProjects());
    syncProjects();
    window.addEventListener(PROJECTS_UPDATED_EVENT, syncProjects);
    return () => window.removeEventListener(PROJECTS_UPDATED_EVENT, syncProjects);
  }, []);

  const handleNewTask = () => {
    reset();
    setMobileOpen(false);
    navigate('/');
  };

  const handleTaskClick = (run: HistoryRun) => {
    setViewingHistory(run);
    setMobileOpen(false);
    navigate('/dashboard');
  };

  const handleClearHistory = () => {
    if (!window.confirm('Clear the local task history in this browser?')) {
      return;
    }
    useStore.setState({ history: [] });
    toast.success('Task history cleared');
  };

  const handleShare = async () => {
    const shareText = 'Try AgentOS for autonomous workflows and AI-powered task execution.';
    const shareUrl = window.location.origin;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'AgentOS', text: shareText, url: shareUrl });
        return;
      } catch {
        // Fall back to clipboard below if share is cancelled or unavailable.
      }
    }

    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    toast.success('Share link copied to clipboard');
  };

  const filteredHistory = history
    .filter((r) => !searchQuery || r.task.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((r) => !filterStatus || r.status === filterStatus);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { navigate('/'); setMobileOpen(false); }}>
          <HexLogo size={24} />
          <span className="text-foreground font-medium tracking-tight text-sm">AgentOS</span>
        </div>
        {isMobile ? (
          <button
            onClick={() => setMobileOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-surface-elevated active:scale-95"
          >
            <X size={18} />
          </button>
        ) : (
          <button
            onClick={() => setCollapsed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-surface-elevated active:scale-95"
            title="Minimize sidebar"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {/* Mode switcher */}
      <SidebarModeSwitch />

      {/* Main navigation */}
      <div className="px-3 py-2 space-y-0.5">
        <button
          onClick={handleNewTask}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.98]"
        >
          <Plus size={16} className="text-muted-foreground" />
          <span>New task</span>
        </button>
        <button
          onClick={() => setAgentsOpen(!agentsOpen)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors active:scale-[0.98] ${agentsOpen ? 'bg-surface-elevated text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'}`}
        >
          <Bot size={16} />
          <span>Agents</span>
        </button>
        <button
          onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchQuery(''); }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors active:scale-[0.98] ${searchOpen ? 'bg-surface-elevated text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'}`}
        >
          <Search size={16} />
          <span>Search</span>
        </button>
        <button
          onClick={() => setLibraryOpen(!libraryOpen)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors active:scale-[0.98] ${libraryOpen ? 'bg-surface-elevated text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'}`}
        >
          <BookOpen size={16} />
          <span>Library</span>
        </button>
      </div>

      {/* Agents panel */}
      {agentsOpen && (
        <div className="px-3 pb-2 log-entry-enter">
          <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Agent Templates</p>
            {[
              { name: 'Code Reviewer', desc: 'Finds bugs, regressions, and missing tests' },
              { name: 'Bug Fixer', desc: 'Reproduces issues and ships focused fixes' },
              { name: 'Refactor Planner', desc: 'Improves structure without breaking behavior' },
            ].map((agent) => (
              <button
                key={agent.name}
                onClick={() => {
                  useStore.getState().setTask(`Act as a ${agent.name}: `);
                  setAgentsOpen(false);
                  setMobileOpen(false);
                  navigate('/dashboard');
                }}
                className="w-full text-left px-2.5 py-2 rounded-md hover:bg-surface-elevated transition-colors"
              >
                <p className="text-xs font-medium text-foreground">{agent.name}</p>
                <p className="text-[11px] text-muted-foreground">{agent.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Library panel */}
      {libraryOpen && (
        <div className="px-3 pb-2 log-entry-enter">
          <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">Library</p>
              <button
                onClick={() => setProjectsOpen(true)}
                className="text-[11px] text-primary hover:text-primary/80 transition-colors"
              >
                Manage projects
              </button>
            </div>
            {currentProject && (
              <div className="rounded-lg border border-primary/15 bg-primary/8 px-2.5 py-2">
                <p className="text-xs font-medium text-foreground">{currentProject.name}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {currentProject.knowledge.length} docs available to the workspace
                </p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Projects</p>
              {projects.length > 0 ? (
                projects.slice(0, 4).map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      useStore.getState().setCurrentProjectId(project.id);
                      setLibraryOpen(false);
                      setMobileOpen(false);
                      toast.success(`${project.name} is now active`);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-md hover:bg-surface-elevated transition-colors"
                  >
                    <p className="text-xs text-foreground truncate">{project.name}</p>
                    <p className="text-[11px] text-muted-foreground">{project.knowledge.length} docs</p>
                  </button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-1.5">No projects yet</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Recent tasks</p>
              {history.length > 0 ? (
                history.slice(0, 4).map((run) => (
                  <button
                    key={run.run_id}
                    onClick={() => {
                      useStore.getState().setTask(run.task);
                      setLibraryOpen(false);
                      setMobileOpen(false);
                      navigate('/dashboard');
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-surface-elevated transition-colors"
                  >
                    <p className="text-xs text-foreground truncate">{run.task}</p>
                  </button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-1.5">No saved tasks yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border mx-3" />

      <div className="px-3 py-2">
        <button
          onClick={() => setProjectsOpen(true)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.98]"
        >
          <FolderPlus size={16} />
          <span>New project</span>
        </button>
      </div>

      {searchOpen && (
        <div className="px-3 pb-2 log-entry-enter">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            autoFocus
            className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}

      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center justify-between px-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">All tasks</span>
          <div className="flex items-center gap-1">
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                title="Clear history"
              >
                <Trash2 size={12} />
              </button>
            )}
            <button
              onClick={() => setFilterStatus(filterStatus ? null : 'done')}
              className={`transition-colors p-0.5 ${filterStatus ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              title="Filter tasks"
            >
              <SlidersHorizontal size={13} />
            </button>
          </div>
        </div>
        {filterStatus && (
          <div className="flex gap-1 px-3 mt-1.5">
            {['done', 'error', 'running'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? null : s)}
                className={`text-[10px] px-2 py-0.5 rounded-full capitalize transition-colors ${
                  filterStatus === s ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-1 space-y-0.5">
        {filteredHistory.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            {searchQuery ? 'No matching tasks' : 'No tasks yet'}
          </p>
        )}
        {filteredHistory.map((run) => (
          <button
            key={run.run_id}
            onClick={() => handleTaskClick(run)}
            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-elevated transition-colors group"
          >
            <div className="flex items-start gap-2.5">
              <div className={`status-dot mt-1.5 shrink-0 ${statusDot[run.status]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate leading-snug">{run.task}</p>
                <span className="text-xs text-muted-foreground mt-0.5 block">
                  {new Date(run.date).toLocaleDateString()} · {run.steps} steps
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Tool status */}
      <SidebarToolStatus />

      {/* Referral */}
      <div className="mx-3 mb-2">
        <button
          onClick={handleShare}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 transition-colors text-left active:scale-[0.98]"
        >
          <Share2 size={16} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">Share AgentOS with a friend</p>
            <p className="text-xs text-muted-foreground">Get 500 credits each</p>
          </div>
          <ChevronRight size={14} className="text-muted-foreground shrink-0" />
        </button>
      </div>

      <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => { openSettingsFor('general'); setMobileOpen(false); }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Settings">
            <Settings size={16} />
          </button>
          <button
            onClick={() => { openSettingsFor('connectors'); setMobileOpen(false); }}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95"
            title="Connectors"
          >
            <Plug size={16} />
          </button>
          <button
            onClick={() => { openSettingsFor('cloud-browser'); setMobileOpen(false); }}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95"
            title="Cloud browser"
          >
            <Globe size={16} />
          </button>
        </div>
      </div>
      <Suspense fallback={null}>
        <ProjectsModal open={projectsOpen} onClose={() => setProjectsOpen(false)} />
      </Suspense>
    </div>
  );

  // Mobile: render hamburger button + sheet drawer
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-card/90 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[280px] p-0 bg-card border-r border-border">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop collapsed
  if (collapsed) {
    return (
      <div className="w-14 shrink-0 h-screen bg-card border-r border-border flex flex-col items-center py-3 gap-1 transition-all duration-300">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95 mb-2"
          title="Expand sidebar"
        >
          <PanelLeftOpen size={18} />
        </button>
        <div className="w-6 h-6 flex items-center justify-center mb-2">
          <HexLogo size={20} />
        </div>
        <button onClick={handleNewTask} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="New task">
          <Plus size={16} />
        </button>
        <button onClick={() => { setCollapsed(false); setAgentsOpen(true); }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Agents">
          <Bot size={16} />
        </button>
        <button onClick={() => { setCollapsed(false); setSearchOpen(true); }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Search">
          <Search size={16} />
        </button>
        <button onClick={() => { setCollapsed(false); setLibraryOpen(true); }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Library">
          <BookOpen size={16} />
        </button>

        <div className="flex-1" />

        <button onClick={() => openSettingsFor('general')} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Settings">
          <Settings size={16} />
        </button>
        <button onClick={() => { setCollapsed(false); openSettingsFor('connectors'); }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Connectors">
          <Plug size={16} />
        </button>
        <button onClick={() => { setCollapsed(false); openSettingsFor('cloud-browser'); }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Cloud browser">
          <Globe size={16} />
        </button>
      </div>
    );
  }

  // Desktop expanded
  return (
    <div className="w-[260px] shrink-0 h-screen bg-card border-r border-border flex flex-col transition-all duration-300">
      {sidebarContent}
    </div>
  );
};

export default TaskSidebar;
