import { Suspense, lazy, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import TaskSidebar from '@/components/TaskSidebar';
import ChatPanel from '@/components/ChatPanel';
import WorkspaceDock from '@/components/chat/WorkspaceDock';
import BackendOfflineOverlay from '@/components/BackendOfflineOverlay';
import { useStore } from '@/store/useStore';
import { useIsMobile } from '@/hooks/use-mobile';

const SettingsModal = lazy(() => import('@/components/SettingsModal'));

const Dashboard = () => {
  const navigate = useNavigate();
  const task = useStore((s) => s.task);
  const status = useStore((s) => s.status);
  const startAgent = useStore((s) => s.startAgent);
  const mode = useStore((s) => s.mode);
  const activeWorkspace = useStore((s) => s.activeWorkspace);
  const workspacePanelOpen = useStore((s) => s.workspacePanelOpen);
  const workspacePanelView = useStore((s) => s.workspacePanelView);
  const closeWorkspacePanel = useStore((s) => s.closeWorkspacePanel);
  const setWorkspacePanelView = useStore((s) => s.setWorkspacePanelView);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (task && status === 'idle' && mode === 'agent') {
      startAgent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen w-full overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 bg-background">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Retour"
          >
            <ArrowLeft size={16} />
            <span className="text-xs">Retour</span>
          </button>
        </div>
        <TaskSidebar />
        <div className="flex-1 flex flex-col min-h-0">
          <ChatPanel />
        </div>

        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
        <BackendOfflineOverlay />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 bg-background">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-white/10"
          aria-label="Retour"
        >
          <ArrowLeft size={16} />
          <span className="text-xs">Retour</span>
        </button>
      </div>
      <div className="flex flex-1 min-h-0">
        <TaskSidebar />
        <ChatPanel />
        <WorkspaceDock
          workspace={activeWorkspace}
          open={workspacePanelOpen}
          view={workspacePanelView}
          onClose={closeWorkspacePanel}
          onChangeView={setWorkspacePanelView}
        />
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
        <BackendOfflineOverlay />
      </div>
    </div>
  );
};

export default Dashboard;
