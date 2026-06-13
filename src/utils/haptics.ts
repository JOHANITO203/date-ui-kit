// Haptic feedback. On native (Capacitor) this uses the OS haptics engine — which
// notably gives iOS real haptics (the web Vibration API is unsupported in iOS
// Safari). On web it falls back to navigator.vibrate (Android browsers).
import { Capacitor } from '@capacitor/core';

export type HapticPattern = 'select' | 'light' | 'medium' | 'success' | 'error';

const WEB_PATTERNS: Record<HapticPattern, number | number[]> = {
  select: 6,
  light: 12,
  medium: 22,
  success: [16, 40, 30],
  error: [38, 28, 38],
};

const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const nativeHaptic = (pattern: HapticPattern): void => {
  // Fire-and-forget: keep haptic() synchronous for hot paths (swipes).
  void (async () => {
    try {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      if (pattern === 'success') {
        await Haptics.notification({ type: NotificationType.Success });
      } else if (pattern === 'error') {
        await Haptics.notification({ type: NotificationType.Error });
      } else {
        const style =
          pattern === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
        await Haptics.impact({ style });
      }
    } catch {
      /* plugin unavailable — silently skip */
    }
  })();
};

/** Trigger a haptic tap. No-ops where unsupported. */
export const haptic = (pattern: HapticPattern = 'light'): void => {
  if (Capacitor.isNativePlatform()) {
    nativeHaptic(pattern);
    return;
  }
  if (!canVibrate()) return;
  try {
    navigator.vibrate(WEB_PATTERNS[pattern]);
  } catch {
    /* ignore */
  }
};
