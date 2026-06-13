// Lightweight haptic feedback via the Vibration API.
// Feature-detected and a safe no-op where unsupported (notably iOS Safari,
// which does not implement navigator.vibrate). Patterns are intentionally short
// so they read as subtle taps, not buzzes.

export type HapticPattern = 'select' | 'light' | 'medium' | 'success' | 'error';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  select: 6,
  light: 12,
  medium: 22,
  success: [16, 40, 30], // match / positive confirmation
  error: [38, 28, 38],
};

const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

/** Trigger a haptic tap. No-ops silently when unsupported. */
export const haptic = (pattern: HapticPattern = 'light'): void => {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    /* ignore — some browsers throw under gesture/permission constraints */
  }
};
