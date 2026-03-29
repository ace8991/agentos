/**
 * Local auth client — calls FastAPI backend only.
 * Token stored in localStorage under key 'agentos_token'.
 * No Supabase, no Firebase, no external API whatsoever.
 */

import { API_BASE_URL } from './api';

const TOKEN_KEY = 'agentos_token';
const USER_KEY = 'agentos_user';
const GUEST_KEY = 'agentos_guest';

export interface AuthUser {
  id: number;
  email: string;
  display_name: string;
  created_at?: string;
  last_login?: string;
}

const getStorage = () => (typeof window !== 'undefined' ? window.localStorage : null);

export function getToken(): string | null {
  return getStorage()?.getItem(TOKEN_KEY) || null;
}

export function getStoredUser(): AuthUser | null {
  const raw = getStorage()?.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isGuestSession(): boolean {
  return getStorage()?.getItem(GUEST_KEY) === 'true';
}

export function getGuestUser(): AuthUser {
  return {
    id: 0,
    email: 'guest@local.agentos',
    display_name: 'Guest',
  };
}

function saveSession(token: string, user: AuthUser) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user));
  storage.removeItem(GUEST_KEY);
}

export function enableGuestSession() {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(GUEST_KEY, 'true');
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(USER_KEY);
}

export function clearSession() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(USER_KEY);
  storage.removeItem(GUEST_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function register(email: string, displayName: string, password: string) {
  const r = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, display_name: displayName, password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || 'Registration failed');
  saveSession(data.access_token as string, data.user as AuthUser);
  return { user: data.user as AuthUser, token: data.access_token as string };
}

export async function login(email: string, password: string) {
  const r = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || 'Invalid email or password');
  saveSession(data.access_token as string, data.user as AuthUser);
  return { user: data.user as AuthUser, token: data.access_token as string };
}

export async function logout() {
  clearSession();
}

export async function getMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const r = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      clearSession();
      return null;
    }
    const user = (await r.json()) as AuthUser;
    getStorage()?.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch {
    return null;
  }
}
