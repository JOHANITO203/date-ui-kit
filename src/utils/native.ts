// Native-platform bridge (Capacitor). On web these all fall back gracefully, so
// the same codebase runs as a PWA in the browser and as a native app via Capacitor.
import { Capacitor } from '@capacitor/core';

export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

/** 'ios' | 'android' | 'web' */
export const getPlatform = (): string => Capacitor.getPlatform();

/**
 * Share content via the native share sheet (Capacitor) or the Web Share API.
 * Returns true if a share UI was shown.
 */
export const shareContent = async (data: {
  title?: string;
  text?: string;
  url?: string;
}): Promise<boolean> => {
  if (isNativePlatform()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share(data);
      return true;
    } catch {
      return false;
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

/** Configure native chrome (status bar) once at startup. No-op on web. */
export const initNativeShell = async (): Promise<void> => {
  if (!isNativePlatform()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* status-bar plugin not available on this platform */
  }
};
