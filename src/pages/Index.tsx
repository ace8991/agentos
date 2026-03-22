import AgentControl from '@/components/AgentControl';
import LiveFeed from '@/components/LiveFeed';
import SettingsModal from '@/components/SettingsModal';
import BackendOfflineOverlay from '@/components/BackendOfflineOverlay';

const Index = () => (
  <div className="flex min-h-screen min-w-[1024px]">
    <AgentControl />
    <LiveFeed />
    <SettingsModal />
    <BackendOfflineOverlay />
  </div>
);

export default Index;
