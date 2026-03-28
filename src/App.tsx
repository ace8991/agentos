import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStore } from "@/store/useStore";
import RemoteCommandBridge from "@/components/RemoteCommandBridge";

const Welcome = lazy(() => import("./pages/Welcome.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

const RuntimeSync = () => {
  const syncBackendHealth = useStore((s) => s.syncBackendHealth);

  useEffect(() => {
    syncBackendHealth();
    const interval = window.setInterval(() => {
      syncBackendHealth();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [syncBackendHealth]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RuntimeSync />
        <RemoteCommandBridge />
        <Suspense fallback={<div className="h-screen w-full bg-background" />}>
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
