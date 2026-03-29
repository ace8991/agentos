import { create } from 'zustand';
import type { AuthUser } from '@/lib/auth';
import { getGuestUser, getStoredUser, getToken, isGuestSession } from '@/lib/auth';

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  guestMode: boolean;
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (v: boolean) => void;
  setGuestMode: (guestMode: boolean) => void;
  isAuthenticated: () => boolean;
  canAccessApp: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: isGuestSession() ? getGuestUser() : getStoredUser(),
  token: getToken(),
  loading: true,
  guestMode: isGuestSession(),
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setLoading: (loading) => set({ loading }),
  setGuestMode: (guestMode) =>
    set({
      guestMode,
      user: guestMode ? getGuestUser() : get().user,
      token: guestMode ? null : get().token,
    }),
  isAuthenticated: () => !!get().token && !!get().user && !get().guestMode,
  canAccessApp: () => get().guestMode || (!!get().token && !!get().user),
}));
