import { useEffect } from 'react';
import TaskSidebar from '@/components/TaskSidebar';
import ChatPanel from '@/components/ChatPanel';
import ExecutionScreen from '@/components/ExecutionScreen';
import SettingsModal from '@/components/SettingsModal';
import BackendOfflineOverlay from '@/components/BackendOfflineOverlay';
import { useStore } from '@/store/useStore';

const Dashboard = () => {
  const task = useStore((s) => s.task);
  const status = useStore((s) => s.status);
  const startAgent = useStore((s) => s.startAgent);

  // Auto-start agent if task is set and we're idle (coming from Welcome page)
  useEffect(() => {
    if (task && status === 'idle') {
      startAgent();
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <TaskSidebar />
      <ChatPanel />
      <ExecutionScreen />
      <SettingsModal />
      <BackendOfflineOverlay />
    </div>
  );
};

export default Dashboard;
