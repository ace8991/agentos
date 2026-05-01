import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AgentControl from '@/components/AgentControl';
import LiveFeed from '@/components/LiveFeed';
import SettingsModal from '@/components/SettingsModal';
import BackendOfflineOverlay from '@/components/BackendOfflineOverlay';

const Index = () => {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen min-w-[1024px]">
      <div className="fixed top-3 left-3 z-50">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-white/10 bg-background/80 backdrop-blur-sm"
          aria-label="Retour"
        >
          <ArrowLeft size={18} />
        </button>
      </div>
      <AgentControl />
      <LiveFeed />
      <SettingsModal />
      <BackendOfflineOverlay />
    </div>
  );
};

export default Index;
