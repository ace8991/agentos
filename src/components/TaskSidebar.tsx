import { Suspense, lazy, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Settings, BookOpen, Bot, FolderPlus,
  Download, ChevronRight, Plug, Globe, PanelLeftClose, PanelLeftOpen,
  Menu, X, LogOut, Smartphone
} from 'lucide-react';
import { useStore, type HistoryRun } from '@/store/useStore';
import { useAuthStore } from '@/store/authStore';
import HexLogo from './HexLogo';
import SidebarToolStatus from './sidebar/SidebarToolStatus';
import { getCurrentProject, loadProjects, PROJECTS_UPDATED_EVENT, type AppProject } from '@/lib/projects';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/components/ui/sonner';
import { downloadWorkspaceArchive } from '@/lib/api';
import { logout as logoutSession } from '@/lib/auth';

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
  const deleteHistoryRun = useStore((s) => s.deleteHistoryRun);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const authUser = useAuthStore((s) => s.user);
  const setAuthUser = useAuthStore((s) => s.setUser);
  const setAuthToken = useAuthStore((s) => s.setToken);
  const setGuestMode = useAuthStore((s) => s.setGuestMode);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projects, setProjects] = useState<AppProject[]>(() => loadProjects());
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const currentProject = projects.find((project) => project.id === currentProjectId) || getCurrentProject(projects);
  const userInitial = authUser?.display_name?.trim().charAt(0).toUpperCase() || 'A';

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

  const handleDownloadLocal = async () => {
    try {
      await downloadWorkspaceArchive();
      toast.success('Downloading AgentOS local workspace');
    } catch {
      toast.error('Could not prepare the local download. Make sure the backend is running.');
    }
  };

  const handleLogout = async () => {
    await logoutSession();
    setAuthUser(null);
    setAuthToken(null);
    setGuestMode(false);
    setMobileOpen(false);
    navigate('/auth');
  };

  const filteredHistory = history
    .filter((r) => !searchQuery || r.task.toLowerCase().includes(searchQuery.toLowerCase()));

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
        <button
          onClick={() => {
            openSettingsFor('openclaw-hub');
            setMobileOpen(false);
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-[0.98]"
        >
          <Smartphone size={16} />
          <span>Mobile hub</span>
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

      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-1 space-y-0.5">
        {filteredHistory.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            {searchQuery ? 'No matching tasks' : 'No tasks yet'}
          </p>
        )}
        {filteredHistory.map((run) => (
          <div
            key={run.run_id}
            className="group flex items-start gap-2 rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <button
              onClick={() => handleTaskClick(run)}
              className="min-w-0 flex-1 px-3 py-2.5 text-left"
            >
              <div className="flex items-start gap-2.5">
                <div className={`status-dot mt-1.5 shrink-0 ${statusDot[run.status]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm leading-snug text-foreground">{run.task}</p>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {new Date(run.date).toLocaleDateString()} · {run.steps} steps
                  </span>
                </div>
              </div>
            </button>
            <button
              onClick={() => deleteHistoryRun(run.run_id)}
              className="mr-2 mt-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-background hover:text-foreground group-hover:opacity-100"
              title="Delete conversation"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Tool status */}
      <SidebarToolStatus />

      {/* Referral */}
      <div className="mx-3 mb-2">
        <button
          onClick={handleDownloadLocal}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 transition-colors text-left active:scale-[0.98]"
        >
          <Download size={16} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">Download AgentOS locally</p>
            <p className="text-xs text-muted-foreground">Get the complete app workspace as a zip</p>
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
      <div className="border-t border-border px-3 py-3">
        <div className="group flex items-center gap-3 rounded-xl border border-border bg-muted/25 px-3 py-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/18 text-sm font-semibold text-violet-300">
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {authUser?.display_name || 'Guest'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {authUser?.email || 'guest@local.agentos'}
            </p>
          </div>
          <button
            onClick={() => void handleLogout()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground active:scale-95"
            title="Log out"
          >
            <LogOut size={15} />
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
        <button onClick={() => { setCollapsed(false); openSettingsFor('openclaw-hub'); }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95" title="Mobile hub">
          <Smartphone size={16} />
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
        <button
          onClick={() => void handleLogout()}
          className="mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/18 text-xs font-semibold text-violet-300 hover:bg-violet-500/24"
          title={authUser?.display_name || 'Guest'}
        >
          {userInitial}
        </button>
        <button
          onClick={() => void handleLogout()}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors active:scale-95"
          title="Log out"
        >
          <LogOut size={16} />
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
