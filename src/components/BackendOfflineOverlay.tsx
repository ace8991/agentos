import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { WifiOff, X } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

const BackendOfflineOverlay = () => {
  const backendOnline = useStore((s) => s.backendOnline);
  const setBackendOnline = useStore((s) => s.setBackendOnline);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (backendOnline) {
      setDismissed(false);
      return;
    }

    const check = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`);
        if (res.ok) setBackendOnline(true);
      } catch {
        // Keep polling quietly until the backend comes back.
      }
    }, 5000);

    return () => clearInterval(check);
  }, [backendOnline, setBackendOnline]);

  if (backendOnline || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-[100] flex w-[90vw] max-w-sm -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
      <WifiOff size={16} className="shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground">Backend hors ligne</p>
        <p className="text-[10px] text-muted-foreground">
          Les reponses simples restent disponibles. Les actions web, browser, terminal et desktop reviennent des que le backend est reconnecte.
        </p>
      </div>
      <button onClick={() => setDismissed(true)} className="shrink-0 text-muted-foreground hover:text-foreground">
        <X size={14} />
      </button>
    </div>
  );
};

export default BackendOfflineOverlay;
