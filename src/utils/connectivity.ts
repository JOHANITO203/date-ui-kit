import { useEffect, useState } from 'react';

/** React hook tracking browser online/offline state. */
export const useOnlineStatus = (): boolean => {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return online;
};

/**
 * Drop the SW runtime caches (API responses + images). Call on logout so an
 * authenticated user's cached data does not linger in CacheStorage on a shared
 * device. Precached app-shell assets are left intact.
 */
export const clearAppCaches = async (): Promise<void> => {
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith('exotic-')).map((key) => caches.delete(key)),
    );
  } catch {
    /* ignore */
  }
};
