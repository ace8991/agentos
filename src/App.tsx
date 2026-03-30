import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getGuestUser, getMe, getStoredUser, getToken, isGuestSession } from "@/lib/auth";
import { getOpenClawState, syncRuntimeConfig } from "@/lib/api";
import { useStore } from "@/store/useStore";
import { useAuthStore } from "@/store/authStore";
import RemoteCommandBridge from "@/components/RemoteCommandBridge";
import AgentDockOverlay from "@/components/AgentDockOverlay";
import { publishAgentDockSnapshot } from "@/lib/agent-dock-bridge";
import { mirrorOpenClawOverlayState } from "@/lib/openclaw";
import Welcome from "./pages/Welcome.tsx";

const AuthPage = lazy(() => import("./pages/AuthPage.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const AgentDockWindow = lazy(() => import("./pages/AgentDockWindow.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

const RuntimeSync = () => {
  const syncBackendHealth = useStore((s) => s.syncBackendHealth);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    const probe = async () => {
      try {
        await syncRuntimeConfig();
        const openClaw = await getOpenClawState();
        mirrorOpenClawOverlayState(openClaw.overlays);
      } catch {
        // The backend may be offline; health probing below will surface the current state.
      }
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

const AgentDockSync = () => {
  const runId = useStore((s) => s.runId);
  const status = useStore((s) => s.status);
  const task = useStore((s) => s.task);
  const currentStep = useStore((s) => s.currentStep);
  const maxSteps = useStore((s) => s.maxSteps);
  const elapsedTime = useStore((s) => s.elapsedTime);
  const currentScreenshot = useStore((s) => s.currentScreenshot);
  const browserUrl = useStore((s) => s.browserUrl);
  const browserTitle = useStore((s) => s.browserTitle);
  const lastSurface = useStore((s) => s.lastSurface);
  const entries = useStore((s) => s.entries);

  useEffect(() => {
    const latestEntry = entries.find((entry) => entry.type !== "info") ?? entries[0] ?? null;
    publishAgentDockSnapshot({
      visible: !!task && (status === "running" || status === "paused" || status === "error"),
      runId,
      status,
      task,
      currentStep,
      maxSteps,
      elapsedTime,
      browserUrl,
      browserTitle,
      currentScreenshot,
      lastSurface,
      latestAction: latestEntry?.action ?? null,
      latestReasoning: latestEntry?.reasoning ?? null,
      latestToolLabel: latestEntry?.toolLabel ?? null,
      updatedAt: new Date().toISOString(),
    });
  }, [
    browserTitle,
    browserUrl,
    currentScreenshot,
    currentStep,
    elapsedTime,
    entries,
    lastSurface,
    maxSteps,
    runId,
    status,
    task,
  ]);

  return null;
};

const RouteFallback = () => (
  <div className="flex h-screen w-full items-center justify-center bg-[linear-gradient(180deg,#6679a6_0%,#3a334c_48%,#121520_100%)]">
    <div className="rounded-3xl border border-white/12 bg-black/20 px-5 py-3 text-sm font-medium text-white/88 backdrop-blur-xl">
      AgentOS is loading...
    </div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const guestMode = useAuthStore((s) => s.guestMode);

  if (loading) return <RouteFallback />;
  if (!user && !guestMode) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AuthSync = () => {
  const setUser = useAuthStore((s) => s.setUser);
  const setToken = useAuthStore((s) => s.setToken);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setGuestMode = useAuthStore((s) => s.setGuestMode);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const cachedUser = getStoredUser();
      const cachedToken = getToken();

      try {
        const user = await getMe();
        if (cancelled) return;

        if (user) {
          setGuestMode(false);
          setUser(user);
          setToken(getToken());
          setLoading(false);
          return;
        }

        if (isGuestSession()) {
          setGuestMode(true);
          setUser(getGuestUser());
          setToken(null);
        } else if (cachedUser && cachedToken) {
          setGuestMode(false);
          setUser(cachedUser);
          setToken(cachedToken);
        } else {
          setGuestMode(false);
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, [setGuestMode, setLoading, setToken, setUser]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthSync />
        <RuntimeSync />
        <AgentDockSync />
        <RemoteCommandBridge />
        <Suspense fallback={<RouteFallback />}>
          <AgentDockOverlay />
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/agent-dock" element={<AgentDockWindow />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
