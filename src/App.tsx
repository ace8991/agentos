import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore } from "@/store/useStore";
import RemoteCommandBridge from "@/components/RemoteCommandBridge";
import Welcome from "./pages/Welcome.tsx";

const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

const RuntimeSync = () => {
  const syncBackendHealth = useStore((s) => s.syncBackendHealth);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    const probe = async () => {
      await syncBackendHealth();
      if (cancelled) {
        return;
      }
      const delay = useStore.getState().backendOnline ? 15000 : 60000;
      timeoutId = window.setTimeout(probe, delay);
    };

    void probe();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [syncBackendHealth]);

  return null;
};

const RouteFallback = () => (
  <div className="flex h-screen w-full items-center justify-center bg-[linear-gradient(180deg,#6679a6_0%,#3a334c_48%,#121520_100%)]">
    <div className="rounded-3xl border border-white/12 bg-black/20 px-5 py-3 text-sm font-medium text-white/88 backdrop-blur-xl">
      AgentOS is loading...
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RuntimeSync />
        <RemoteCommandBridge />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
