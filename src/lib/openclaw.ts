import type { OpenClawOverlayState } from '@/lib/api';

const STORAGE_KEYS = {
  floatingDock: 'OPENCLAW_FLOATING_DOCK',
  mobileHud: 'OPENCLAW_MOBILE_HUD',
  voiceOverlay: 'OPENCLAW_VOICE_OVERLAY',
  voiceWake: 'OPENCLAW_VOICE_WAKE',
  cameraHud: 'OPENCLAW_CAMERA_HUD',
  pushToTalk: 'OPENCLAW_PUSH_TO_TALK',
} as const;

export const mirrorOpenClawOverlayState = (overlays: OpenClawOverlayState) => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(STORAGE_KEYS.floatingDock, String(overlays.floating_dock));
  localStorage.setItem(STORAGE_KEYS.mobileHud, String(overlays.mobile_hud));
  localStorage.setItem(STORAGE_KEYS.voiceOverlay, String(overlays.voice_overlay));
  localStorage.setItem(STORAGE_KEYS.voiceWake, String(overlays.voice_wake));
  localStorage.setItem(STORAGE_KEYS.cameraHud, String(overlays.camera_hud));
  localStorage.setItem(STORAGE_KEYS.pushToTalk, overlays.push_to_talk);
};

const readBoolean = (key: string, fallback: boolean) => {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : raw === 'true';
};

export const getOpenClawOverlayPrefs = () => ({
  floatingDock: readBoolean(STORAGE_KEYS.floatingDock, true),
  mobileHud: readBoolean(STORAGE_KEYS.mobileHud, true),
  voiceOverlay: readBoolean(STORAGE_KEYS.voiceOverlay, true),
  voiceWake: readBoolean(STORAGE_KEYS.voiceWake, false),
  cameraHud: readBoolean(STORAGE_KEYS.cameraHud, false),
  pushToTalk: typeof window === 'undefined' ? 'Ctrl+Shift+Space' : localStorage.getItem(STORAGE_KEYS.pushToTalk) || 'Ctrl+Shift+Space',
});
