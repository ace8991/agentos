import { createPortal } from 'react-dom';
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  FileText,
  FolderOpen,
  Globe as GlobeIcon,
  Ghost,
  KeyRound,
  Layers3,
  Mic,
  Monitor,
  MoreHorizontal,
  Paperclip,
  Plus,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wand2,
  X,
} from 'lucide-react';
import TaskSidebar from '@/components/TaskSidebar';
import ComposerInsertMenu from '@/components/chat/ComposerInsertMenu';
import ConnectorQuickAccess from '@/components/chat/ConnectorQuickAccess';
import { useStore } from '@/store/useStore';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  CONNECTORS_UPDATED_EVENT,
  loadConnectors,
  mergeConnectorState,
  saveConnectors,
  type ConnectorState,
} from '@/lib/connectors';
import { getCurrentProject, loadProjects, PROJECTS_UPDATED_EVENT, type AppProject } from '@/lib/projects';
import { toast } from '@/components/ui/sonner';
import { getSavedResponseStyleLabel } from '@/lib/user-config';

const SettingsModal = lazy(() => import('@/components/SettingsModal'));
const ConnectorConfigModal = lazy(() => import('@/components/chat/ConnectorConfigModal'));
const ConnectorsDirectoryModal = lazy(() => import('@/components/chat/ConnectorsDirectoryModal'));
const ProjectsModal = lazy(() => import('@/components/projects/ProjectsModal'));

const suggestions = [
  { icon: FileText, label: 'Review code' },
  { icon: GlobeIcon, label: 'Build website' },
  { icon: Monitor, label: 'Fix a bug' },
  { icon: Wand2, label: 'Write tests' },
  { icon: MoreHorizontal, label: 'Refactor safely' },
];

type NotificationTarget = 'browser-system' | 'skills' | 'connectors';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  actionLabel: string;
  target: NotificationTarget;
  icon: typeof ShieldCheck;
}

const Welcome = () => {
  const [taskInput, setTaskInput] = useState('');
  const [heroReady, setHeroReady] = useState(false);
  const [connectors, setConnectors] = useState<ConnectorState[]>([]);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [configConnectorId, setConfigConnectorId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const setTask = useStore((s) => s.setTask);
  const openSettingsFor = useStore((s) => s.openSettingsFor);
  const composerPreferences = useStore((s) => s.composerPreferences);
  const setComposerPreferences = useStore((s) => s.setComposerPreferences);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const incognitoMode = useStore((s) => s.incognitoMode);
  const setIncognitoMode = useStore((s) => s.setIncognitoMode);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const composerMenuButtonRef = useRef<HTMLButtonElement>(null);
  const composerMenuPanelRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const notificationsPanelRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const profilePanelRef = useRef<HTMLDivElement>(null);
  const responseStyleLabel = getSavedResponseStyleLabel();
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [projectsOpen, setProjectsOpen] = useState(false);

  useEffect(() => {
    const syncConnectors = () => setConnectors(loadConnectors());
    syncConnectors();
    window.addEventListener(CONNECTORS_UPDATED_EVENT, syncConnectors);

    return () => {
      window.removeEventListener(CONNECTORS_UPDATED_EVENT, syncConnectors);
    };
  }, []);

  useEffect(() => {
    const syncProjects = () => setProjects(loadProjects());
    syncProjects();
    window.addEventListener(PROJECTS_UPDATED_EVENT, syncProjects);

    return () => {
      window.removeEventListener(PROJECTS_UPDATED_EVENT, syncProjects);
    };
  }, []);

  useEffect(() => {
    const isTargetInside = (target: Node, refs: Array<RefObject<HTMLElement | null>>) =>
      refs.some((ref) => ref.current?.contains(target));

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!isTargetInside(target, [notificationsRef, notificationsPanelRef])) {
        setNotificationsOpen(false);
      }
      if (!isTargetInside(target, [profileRef, profilePanelRef])) {
        setProfileOpen(false);
      }
      if (!isTargetInside(target, [composerMenuButtonRef, composerMenuPanelRef])) {
        setComposerMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        setProfileOpen(false);
        setComposerMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const connectedCount = connectors.filter((connector) => connector.connected).length;
  const currentProject = projects.find((project) => project.id === currentProjectId) || getCurrentProject(projects);

  const notifications = useMemo<NotificationItem[]>(
    () => [
      {
        id: 'workspace-ready',
        title: 'Workspace ready',
        body: 'Desktop control, browser automation, and direct chat are available for this session.',
        actionLabel: 'Review system',
        target: 'browser-system',
        icon: ShieldCheck,
      },
      {
        id: 'connectors-ready',
        title: connectedCount > 0 ? `${connectedCount} tools connected` : 'Connect more tools',
        body:
          connectedCount > 0
            ? 'Your connected apps can enrich prompts, workflows, and artifacts.'
            : 'Add services like GitHub, Canva, Telegram, or WhatsApp to unlock richer workflows.',
        actionLabel: 'Open connectors',
        target: 'connectors',
        icon: Layers3,
      },
      {
        id: 'skills-ready',
        title: 'Custom skills available',
        body: 'Create reusable skill instructions and inject them into both agent mode and chat mode.',
        actionLabel: 'Manage skills',
        target: 'skills',
        icon: Sparkles,
      },
    ],
    [connectedCount],
  );

  const unreadCount = notifications.filter((item) => !readNotificationIds.includes(item.id)).length;

  const handleStart = () => {
    if (!taskInput.trim()) return;
    setTask(taskInput.trim());
    setComposerMenuOpen(false);
    navigate('/dashboard');
  };

  const addAttachments = (files: FileList | File[], kind: 'file' | 'image') => {
    const nextFiles = Array.from(files);
    if (nextFiles.length === 0) return;

    setAttachments((previous) => [...previous, ...nextFiles]);
    toast.success(`${nextFiles.length} ${kind}${nextFiles.length > 1 ? 's' : ''} attached`);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    addAttachments(files, 'file');
    event.target.value = '';
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    addAttachments(files, 'image');
    event.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleStart();
    }
  };

  const handleSuggestion = (label: string) => {
    setTaskInput(label);
  };

  const toggleNotifications = () => {
    setNotificationsOpen((open) => {
      const next = !open;
      if (next) {
        setProfileOpen(false);
        setComposerMenuOpen(false);
        setReadNotificationIds((current) => Array.from(new Set([...current, ...notifications.map((item) => item.id)])));
      }
      return next;
    });
  };

  const handleNotificationAction = (target: NotificationTarget) => {
    setNotificationsOpen(false);
    if (target === 'connectors') {
      setDirectoryOpen(true);
      return;
    }
    openSettingsFor(target);
  };

  const handleProfileAction = (section: ReturnType<typeof useStore.getState>['settingsSection']) => {
    setProfileOpen(false);
    openSettingsFor(section);
  };

  const handleComposerConnector = (connectorId: string) => {
    setComposerMenuOpen(false);
    setConfigConnectorId(connectorId);
  };

  const handleToggleComposerPreference = (key: 'webResearch' | 'useStyle') => {
    setComposerPreferences({ [key]: !composerPreferences[key] });
    setComposerMenuOpen(false);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <TaskSidebar />

      <div className="flex-1 flex flex-col h-screen min-w-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#6679a6_0%,#3a334c_48%,#121520_100%)]" />
        <img
          src="/images/hero-bg-user-preview.avif"
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full object-cover object-center scale-[1.035] blur-xl transition-opacity duration-500 select-none ${
            heroReady ? 'opacity-0' : 'opacity-100'
          }`}
          draggable={false}
        />
        <picture className="absolute inset-0 block">
          <source
            type="image/avif"
            srcSet="/images/hero-bg-user-960.avif 960w, /images/hero-bg-user-1536.avif 1536w"
            sizes="100vw"
          />
          <source
            type="image/webp"
            srcSet="/images/hero-bg-user-960.webp 960w, /images/hero-bg-user-1536.webp 1536w"
            sizes="100vw"
          />
          <img
            src="/images/hero-bg-user.png"
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className={`absolute inset-0 h-full w-full object-cover object-center scale-[1.015] transition-opacity duration-500 select-none ${
              heroReady ? 'opacity-100' : 'opacity-0'
            }`}
            draggable={false}
            onLoad={() => setHeroReady(true)}
            onError={() => setHeroReady(true)}
          />
        </picture>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(67,176,255,0.24),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(255,192,120,0.18),transparent_26%),radial-gradient(circle_at_50%_72%,rgba(156,139,255,0.10),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,14,24,0.12)_0%,rgba(10,14,24,0.42)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,11,19,0.20)_0%,rgba(9,11,19,0.04)_45%,rgba(9,11,19,0.20)_100%)]" />

        <div className="relative z-20 flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/10 backdrop-blur-md bg-[rgba(9,12,20,0.14)]">
          <div className="flex items-center gap-2">
            {isMobile && <div className="w-10" />}
            <span className="text-sm text-white font-medium">AgentOS 1.0</span>
            <svg width="10" height="10" viewBox="0 0 10 10" className="text-white/55 mt-0.5">
              <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div ref={notificationsRef} className="relative">
              <button
                onClick={toggleNotifications}
                className="relative text-white/70 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/10 active:scale-95"
                aria-label="Notifications"
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent shadow-[0_0_0_4px_rgba(245,158,11,0.12)]" />
                )}
              </button>

              <FloatingPanel
                anchorRef={notificationsRef}
                panelRef={notificationsPanelRef}
                open={notificationsOpen}
                width={380}
                className="rounded-3xl border border-white/10 bg-[rgba(13,17,27,0.88)] backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.42)] p-3"
              >
                  <div className="flex items-center justify-between px-2 pb-2">
                    <div>
                      <p className="text-sm font-medium text-white">Notifications</p>
                      <p className="text-xs text-white/55">Workspace activity and quick actions</p>
                    </div>
                    <button
                      onClick={() => setReadNotificationIds(notifications.map((item) => item.id))}
                      className="text-xs text-accent hover:text-accent/80 transition-colors"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="space-y-2">
                    {notifications.map((item) => {
                      const Icon = item.icon;
                      const unread = !readNotificationIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`rounded-2xl border px-3 py-3 ${
                            unread ? 'border-white/12 bg-white/[0.06]' : 'border-white/8 bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.05] flex items-center justify-center text-white/80 shrink-0">
                              <Icon size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-white">{item.title}</p>
                                {unread && <span className="h-2 w-2 rounded-full bg-accent shrink-0" />}
                              </div>
                              <p className="text-xs text-white/60 mt-1 leading-relaxed">{item.body}</p>
                              <button
                                onClick={() => handleNotificationAction(item.target)}
                                className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
                              >
                                {item.actionLabel}
                                <ChevronDown size={12} className="-rotate-90" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
              </FloatingPanel>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-white/80">
              <Sparkles size={14} className="text-accent" />
              <span className="text-xs tabular-nums font-medium">164 credits</span>
            </div>

            <div ref={profileRef} className="relative">
              <button
                onClick={() => {
                  setProfileOpen((open) => !open);
                  setNotificationsOpen(false);
                  setComposerMenuOpen(false);
                }}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] pl-1 pr-2 py-1 hover:bg-white/[0.12] transition-colors active:scale-95"
                aria-label="Profile"
              >
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xs font-bold">
                  A
                </div>
                <ChevronDown size={14} className="text-white/60" />
              </button>

              <FloatingPanel
                anchorRef={profileRef}
                panelRef={profilePanelRef}
                open={profileOpen}
                width={300}
                className="rounded-3xl border border-white/10 bg-[rgba(13,17,27,0.90)] backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.42)] overflow-hidden"
              >
                  <div className="px-4 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground font-bold">
                        A
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">AgentOS Workspace</p>
                        <p className="text-xs text-white/55">Premium local agent configuration</p>
                      </div>
                    </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px] text-white/55">
                      {currentProject && (
                        <span className="rounded-full border border-sky-300/16 bg-sky-400/10 px-2.5 py-1 text-sky-100">
                          {currentProject.name}
                        </span>
                      )}
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1">
                        {connectedCount} connectors
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1">
                        Desktop mode ready
                      </span>
                    </div>
                  </div>

                  <div className="p-2">
                    <ProfileAction
                      icon={UserRound}
                      label="Profile & appearance"
                      description="Personalize identity, tone, and workspace defaults"
                      onClick={() => handleProfileAction('personalization')}
                    />
                    <ProfileAction
                      icon={FolderOpen}
                      label="Projects & knowledge"
                      description="Reusable project instructions, notes, and file context"
                      onClick={() => {
                        setProfileOpen(false);
                        setProjectsOpen(true);
                      }}
                    />
                    <ProfileAction
                      icon={KeyRound}
                      label="API keys"
                      description="Manage providers, local model servers, and search keys"
                      onClick={() => handleProfileAction('api-keys')}
                    />
                    <ProfileAction
                      icon={Layers3}
                      label="Connectors"
                      description="Configure GitHub, Canva, Telegram, WhatsApp, and more"
                      onClick={() => handleProfileAction('connectors')}
                    />
                    <ProfileAction
                      icon={Settings2}
                      label="Data & privacy"
                      description="Export, retention, and local workspace controls"
                      onClick={() => handleProfileAction('data')}
                    />
                  </div>
              </FloatingPanel>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex justify-center pt-6 md:pt-8">
          <div className="flex items-center gap-2 text-xs rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 backdrop-blur-md">
            <span className="text-white/55">Free plan</span>
            <span className="text-white/20">|</span>
            <button
              onClick={() => toast.message('Billing workspace is next on the roadmap.')}
              className="text-accent hover:text-accent/80 transition-colors font-medium"
            >
              Start free trial
            </button>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 md:px-8 -mt-2 md:-mt-4">
          <div className="w-full max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/65 backdrop-blur-md">
              Premium Desktop Agent Workspace
            </div>
            <h1
              className="mt-6 text-3xl md:text-5xl font-semibold text-white leading-[1.05]"
              style={{ fontFamily: "'Inter', system-ui, sans-serif", textWrap: 'balance' }}
            >
              What can I do for you?
            </h1>
            <p className="mt-4 text-sm md:text-base text-white/70 max-w-2xl mx-auto leading-relaxed">
              Coordinate research, browser workflows, desktop actions, files, connectors, custom skills, and artifacts from one premium workspace.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setProjectsOpen(true)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  currentProject
                    ? 'border-sky-300/16 bg-sky-400/10 text-sky-100'
                    : 'border-white/12 bg-white/[0.06] text-white/78 hover:text-white hover:bg-white/[0.09]'
                }`}
              >
                <FolderOpen size={13} />
                {currentProject ? currentProject.name : 'Set active project'}
              </button>
              <button
                onClick={() => setIncognitoMode(!incognitoMode)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  incognitoMode
                    ? 'border-amber-300/16 bg-amber-400/10 text-amber-100'
                    : 'border-white/12 bg-white/[0.06] text-white/78 hover:text-white hover:bg-white/[0.09]'
                }`}
              >
                <Ghost size={13} />
                {incognitoMode ? 'Private session' : 'Standard session'}
              </button>
            </div>
          </div>

          <div className="w-full max-w-3xl mt-7 md:mt-9">
            <div className="rounded-[28px] border border-white/12 bg-[rgba(16,19,29,0.54)] shadow-[0_28px_120px_rgba(5,8,17,0.30)] backdrop-blur-2xl overflow-hidden">
              <div className="px-4 md:px-5 pt-4 md:pt-5 pb-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <textarea
                  value={taskInput}
                  onChange={(event) => setTaskInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Assign a task or ask anything"
                  rows={2}
                  className="w-full bg-transparent text-sm md:text-base text-white placeholder:text-white/40 resize-none focus:outline-none leading-relaxed"
                  style={{ minHeight: '48px', maxHeight: '140px' }}
                  onInput={(event) => {
                    const target = event.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 140) + 'px';
                  }}
                />
              </div>

              {attachments.length > 0 && (
                <div className="px-4 md:px-5 pb-2 flex items-center gap-2 flex-wrap">
                  {attachments.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center gap-1.5 bg-white/[0.08] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white">
                      <Paperclip size={11} className="text-white/65" />
                      {file.type.startsWith('image/') && (
                        <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-100">
                          Image
                        </span>
                      )}
                      <span className="truncate max-w-[150px]">{file.name}</span>
                      <button onClick={() => removeAttachment(index)} className="text-white/55 hover:text-white">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {(composerPreferences.webResearch || composerPreferences.useStyle) && (
                <div className="px-4 md:px-5 pb-2 flex items-center gap-2 flex-wrap">
                  {composerPreferences.webResearch && (
                    <button
                      onClick={() => setComposerPreferences({ webResearch: false })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/16 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-100"
                    >
                      <GlobeIcon size={12} />
                      Web research
                      <X size={11} />
                    </button>
                  )}
                  {composerPreferences.useStyle && (
                    <button
                      onClick={() => setComposerPreferences({ useStyle: false })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-300/16 bg-fuchsia-400/10 px-2.5 py-1 text-[11px] font-medium text-fuchsia-100"
                    >
                      <Wand2 size={12} />
                      {responseStyleLabel}
                      <X size={11} />
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between px-3 md:px-4 pb-3 md:pb-4">
                <div className="flex items-center gap-1">
                  <button
                    ref={composerMenuButtonRef}
                    onClick={() => {
                      setComposerMenuOpen((open) => !open);
                      setNotificationsOpen(false);
                      setProfileOpen(false);
                    }}
                    className="p-2 rounded-xl text-white/55 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
                    title="Insert"
                  >
                    <Plus size={18} />
                  </button>
                  <ComposerInsertMenu
                    open={composerMenuOpen}
                    anchorRef={composerMenuButtonRef}
                    panelRef={composerMenuPanelRef}
                    connectedCount={connectedCount}
                    responseStyleLabel={responseStyleLabel}
                    webSearchEnabled={composerPreferences.webResearch}
                    useStyleEnabled={composerPreferences.useStyle}
                    onAddFiles={() => {
                      setComposerMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    onAddImages={() => {
                      setComposerMenuOpen(false);
                      imageInputRef.current?.click();
                    }}
                    onOpenGoogleDrive={() => handleComposerConnector('google-drive')}
                    onOpenGitHub={() => handleComposerConnector('github')}
                    onOpenProjects={() => {
                      setComposerMenuOpen(false);
                      setProjectsOpen(true);
                    }}
                    onOpenSkills={() => {
                      setComposerMenuOpen(false);
                      openSettingsFor('skills');
                    }}
                    onOpenConnectors={() => {
                      setComposerMenuOpen(false);
                      setDirectoryOpen(true);
                    }}
                    onToggleWebSearch={() => handleToggleComposerPreference('webResearch')}
                    onToggleUseStyle={() => handleToggleComposerPreference('useStyle')}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl text-white/55 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
                    title="Attach file"
                  >
                    <Paperclip size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toast.message('Voice input UI is ready for the next backend pass.')}
                    className="p-2 rounded-xl text-white/55 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
                    title="Voice input"
                  >
                    <Mic size={16} />
                  </button>
                  <button
                    onClick={handleStart}
                    disabled={!taskInput.trim()}
                    className="ml-1 h-10 w-10 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-30 active:scale-95 shadow-[0_10px_30px_rgba(245,158,11,0.32)]"
                    title="Start task"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-[rgba(14,17,27,0.28)] backdrop-blur-md px-2 md:px-3 py-2">
              <ConnectorQuickAccess
                connectors={connectors}
                onSelect={setConfigConnectorId}
                onOpenDirectory={() => setDirectoryOpen(true)}
                onOpenSettings={() => openSettingsFor('connectors')}
              />
            </div>
          </div>

          <div className="w-full max-w-3xl mt-6 md:mt-8">
            <div className="flex items-center gap-2 md:gap-2.5 overflow-x-auto scrollbar-thin pb-2 md:justify-center">
              {suggestions.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => handleSuggestion(label)}
                  className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-2xl border border-white/14 bg-white/[0.07] backdrop-blur-sm text-xs md:text-sm text-white/78 hover:text-white hover:bg-white/[0.11] hover:border-white/22 transition-all active:scale-[0.97] shrink-0"
                >
                  <Icon size={15} />
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-4 md:h-8" />
      </div>

      <Suspense fallback={null}>
        <SettingsModal />
        <ProjectsModal open={projectsOpen} onClose={() => setProjectsOpen(false)} />
        <ConnectorsDirectoryModal
          open={directoryOpen}
          connectors={connectors}
          onClose={() => setDirectoryOpen(false)}
          onOpenSettings={() => openSettingsFor('connectors')}
          onSelectConnector={(id) => {
            setDirectoryOpen(false);
            setConfigConnectorId(id);
          }}
        />
        <ConnectorConfigModal
          connectorId={configConnectorId}
          onClose={() => setConfigConnectorId(null)}
          onSave={(nextState) => {
            setConnectors((previous) => {
              const next = mergeConnectorState(previous, nextState);
              saveConnectors(next);
              return next;
            });
            setConfigConnectorId(null);
          }}
        />
      </Suspense>
    </div>
  );
};

const FloatingPanel = ({
  anchorRef,
  panelRef,
  open,
  width,
  className,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  width: number;
  className: string;
  children: ReactNode;
}) => {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const panelWidth = Math.min(width, Math.max(viewportWidth - 24, 220));
      const maxLeft = viewportWidth - panelWidth - 12;
      const left = Math.max(12, Math.min(rect.right - panelWidth, maxLeft));
      const top = rect.bottom + 12;
      const maxHeight = Math.max(220, window.innerHeight - top - 12);

      setStyle({
        top,
        left,
        width: panelWidth,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, open, width]);

  if (!open || !style) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] pointer-events-none">
      <div ref={panelRef} className={`pointer-events-auto fixed overflow-y-auto ${className}`} style={style}>
        {children}
      </div>
    </div>,
    document.body,
  );
};

const ProfileAction = ({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: typeof UserRound;
  label: string;
  description: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full flex items-start gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/[0.06] transition-colors"
  >
    <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/[0.05] flex items-center justify-center text-white/75 shrink-0">
      <Icon size={16} />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="text-xs text-white/55 mt-1 leading-relaxed">{description}</p>
    </div>
  </button>
);

export default Welcome;
