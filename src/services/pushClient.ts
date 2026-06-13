// Web Push subscription client. Talks to auth-bff (/api/push/*) and the service
// worker's PushManager. All calls are session-cookie authenticated.

const AUTH_BFF_URL = (import.meta.env.VITE_AUTH_BFF_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const getPushPermission = (): NotificationPermission =>
  isPushSupported() ? Notification.permission : 'denied';

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
};

export const getExistingSubscription = async (): Promise<PushSubscription | null> => {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
};

export type EnablePushResult = {
  ok: boolean;
  reason?: 'unsupported' | 'denied' | 'not_configured' | 'save_failed' | 'error';
};

/** Request permission, subscribe via the SW, and register with the backend. */
export const enablePush = async (): Promise<EnablePushResult> => {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const keyRes = await fetch(`${AUTH_BFF_URL}/api/push/public-key`, { credentials: 'include' });
    if (!keyRes.ok) return { ok: false, reason: 'not_configured' };
    const { publicKey } = (await keyRes.json()) as { publicKey: string };
    if (!publicKey) return { ok: false, reason: 'not_configured' };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const json = sub.toJSON();
    const res = await fetch(`${AUTH_BFF_URL}/api/push/subscribe`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      }),
    });
    return res.ok ? { ok: true } : { ok: false, reason: 'save_failed' };
  } catch {
    return { ok: false, reason: 'error' };
  }
};

/** Unsubscribe locally and tell the backend to drop the subscription. */
export const disablePush = async (): Promise<void> => {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch(`${AUTH_BFF_URL}/api/push/unsubscribe`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  } catch {
    /* ignore */
  }
};
