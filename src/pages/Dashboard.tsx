import { useEffect, useState } from 'react';
import TaskSidebar from '@/components/TaskSidebar';
import ChatPanel from '@/components/ChatPanel';
import ExecutionScreen from '@/components/ExecutionScreen';
import SettingsModal from '@/components/SettingsModal';
import BackendOfflineOverlay from '@/components/BackendOfflineOverlay';
import { useStore } from '@/store/useStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { Globe, MessageSquare } from 'lucide-react';

const Dashboard = () => {
  const task = useStore((s) => s.task);
  const status = useStore((s) => s.status);
  const startAgent = useStore((s) => s.startAgent);
  const entries = useStore((s) => s.entries);
  const browserUrl = useStore((s) => s.browserUrl);
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<'chat' | 'execution'>('chat');
  const isLive = status === 'running' || status === 'paused';
  const hasExecutionActivity =
    isLive &&
    (entries.some((entry) => entry.type === 'browser' || entry.type === 'shell') || !!browserUrl);

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
        
        {/* Mobile content area */}
        <div className="flex-1 flex flex-col min-h-0">
          {mobileTab === 'chat' || !hasExecutionActivity ? <ChatPanel /> : <ExecutionScreen forceMobile />}
        </div>

        {/* Mobile bottom tab bar */}
        <div className="shrink-0 flex border-t border-border bg-card safe-area-bottom">
          <button
            onClick={() => setMobileTab('chat')}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
              mobileTab === 'chat' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <MessageSquare size={18} />
            <span>Workspace</span>
          </button>
          {hasExecutionActivity && (
            <button
              onClick={() => setMobileTab('execution')}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                mobileTab === 'execution' ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Globe size={18} />
              <span>Live</span>
            </button>
          )}
        </div>

        <SettingsModal />
        <BackendOfflineOverlay />
      </div>
    );
  }

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
