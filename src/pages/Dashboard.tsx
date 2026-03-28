import { Suspense, lazy, useEffect, useState } from 'react';
import TaskSidebar from '@/components/TaskSidebar';
import ChatPanel from '@/components/ChatPanel';
import BackendOfflineOverlay from '@/components/BackendOfflineOverlay';
import { useStore } from '@/store/useStore';
import { useIsMobile } from '@/hooks/use-mobile';

const SettingsModal = lazy(() => import('@/components/SettingsModal'));

const Dashboard = () => {
  const task = useStore((s) => s.task);
  const status = useStore((s) => s.status);
  const startAgent = useStore((s) => s.startAgent);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (task && status === 'idle') {
      startAgent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen w-full overflow-hidden">
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
    <div className="flex h-screen w-full overflow-hidden">
      <TaskSidebar />
      <ChatPanel />
      <Suspense fallback={null}>
        <SettingsModal />
      </Suspense>
      <BackendOfflineOverlay />
    </div>
  );
};

export default Dashboard;
