import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Loader2 } from 'lucide-react';
import HexLogo from './HexLogo';

const BackendOfflineOverlay = () => {
  const backendOnline = useStore((s) => s.backendOnline);
  const setBackendOnline = useStore((s) => s.setBackendOnline);

  useEffect(() => {
    if (backendOnline) return;
    const check = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:8000/health');
        if (res.ok) setBackendOnline(true);
      } catch {}
    }, 3000);
    return () => clearInterval(check);
  }, [backendOnline, setBackendOnline]);

  if (backendOnline) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 flex flex-col items-center justify-center gap-4">
      <HexLogo size={48} />
      <Loader2 size={24} className="text-primary reconnect-spinner" />
      <p className="text-foreground font-medium">Connecting to AgentOS backend...</p>
      <p className="text-sm text-muted-foreground">Auto-retrying every 3s</p>
    </div>
  );
};

export default BackendOfflineOverlay;
