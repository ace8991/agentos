import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getGuestUser, getMe, getStoredUser, getToken, isGuestSession } from "@/lib/auth";
import { getMobileHubState, syncRuntimeConfig } from "@/lib/api";
import { syncImportedSkills } from "@/lib/user-config";
import { useStore } from "@/store/useStore";
import { useAuthStore } from "@/store/authStore";
import RemoteCommandBridge from "@/components/RemoteCommandBridge";
import AgentDockOverlay from "@/components/AgentDockOverlay";
import { publishAgentDockSnapshot } from "@/lib/agent-dock-bridge";
import { mirrorMobileHubOverlayState } from "@/lib/mobile-hub";
import Welcome from "./pages/Welcome.tsx";

const AuthPage = lazy(() => import("./pages/AuthPage.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const CodePage = lazy(() => import("./pages/CodePage.tsx"));
const CoworkPage = lazy(() => import("./pages/CoworkPage.tsx"));
const AgentDockWindow = lazy(() => import("./pages/AgentDockWindow.tsx"));
const ParlorPage = lazy(() => import("./pages/ParlorPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

const HEALTH_BACKOFF_MS = [2500, 5000, 10000];
const RUNTIME_SYNC_MS = 30000;

/** 2.5s while healthy, then 5s, then 10s (capped) after consecutive failures. */
const nextHealthDelay = (failureStreak: number) =>
  HEALTH_BACKOFF_MS[Math.min(failureStreak, HEALTH_BACKOFF_MS.length - 1)];

const RuntimeSync = () => {
  const syncBackendHealth = useStore((s) => s.syncBackendHealth);

  useEffect(() => {
    let cancelled = false;
    let healthTimer: number | null = null;
    let runtimeTimer: number | null = null;
    let polling = false;

    // Fast loop: health only, backing off while offline.
    const pollHealth = async () => {
      if (cancelled || polling) return;
      polling = true;
      try {
        await syncBackendHealth();
      } finally {
        polling = false;
      }
      if (cancelled) return;
      // Mirror backend-online state onto window so non-React code (chatDirect)
      // can fast-path to direct provider calls when the backend is offline.
      try {
        (window as unknown as Record<string, unknown>).__agentos_backend_online__ =
          useStore.getState().backendOnline;
      } catch {
        // ignore
      }
      const delay = nextHealthDelay(useStore.getState().healthFailureStreak);
      if (healthTimer !== null) window.clearTimeout(healthTimer);
      healthTimer = window.setTimeout(pollHealth, delay);
    };

    // Force an immediate probe (tab wake / browser back online) instead of
    // waiting out a 10s backoff step.
    const probeNow = () => {
      if (cancelled) return;
      if (healthTimer !== null) window.clearTimeout(healthTimer);
      void pollHealth();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') probeNow();
    };

    window.addEventListener('online', probeNow);
    document.addEventListener('visibilitychange', onVisibility);

    // Slow loop: runtime config + mobile hub mirror.
    const syncRuntime = async () => {
      try {
        await syncRuntimeConfig();
        const mobileHub = await getMobileHubState();
        mirrorMobileHubOverlayState(mobileHub.overlays);
      } catch {
        // The backend may be offline; the health loop surfaces the current state.
      }
      if (cancelled) return;
      runtimeTimer = window.setTimeout(syncRuntime, RUNTIME_SYNC_MS);
    };

    void syncRuntime();
    void pollHealth();

    return () => {
      cancelled = true;
      window.removeEventListener('online', probeNow);
      document.removeEventListener('visibilitychange', onVisibility);
      if (healthTimer !== null) window.clearTimeout(healthTimer);
      if (runtimeTimer !== null) window.clearTimeout(runtimeTimer);
    };
  }, [syncBackendHealth]);

  return null;
};


const SkillSync = () => {
  useEffect(() => {
    void syncImportedSkills();
  }, []);

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
  <div className="flex h-screen w-full items-center justify-center bg-[linear-gradient(180deg,#3a3a37_0%,#30302E_48%,#262624_100%)]">
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
        <SkillSync />
        <RuntimeSync />
        <AgentDockSync />
        <RemoteCommandBridge />
        <Suspense fallback={<RouteFallback />}>
          <AgentDockOverlay />
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/code" element={<ProtectedRoute><CodePage /></ProtectedRoute>} />
            <Route path="/cowork" element={<ProtectedRoute><CoworkPage /></ProtectedRoute>} />
            <Route path="/parlor" element={<ProtectedRoute><ParlorPage /></ProtectedRoute>} />
            <Route path="/agent-dock" element={<AgentDockWindow />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

