import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { WifiOff, X } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { useState } from 'react';

const BackendOfflineOverlay = () => {
  const backendOnline = useStore((s) => s.backendOnline);
  const setBackendOnline = useStore((s) => s.setBackendOnline);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (backendOnline) { setDismissed(false); return; }
    const check = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`);
        if (res.ok) setBackendOnline(true);
      } catch {}
    }, 5000);
    return () => clearInterval(check);
  }, [backendOnline, setBackendOnline]);

  if (backendOnline || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] bg-card border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm w-[90vw]">
      <WifiOff size={16} className="text-warning shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">Backend hors ligne</p>
        <p className="text-[10px] text-muted-foreground">Le mode Chat direct reste disponible. Agent mode nécessite le backend.</p>
      </div>
      <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground shrink-0">
        <X size={14} />
      </button>
    </div>
  );
};

export default BackendOfflineOverlay;
