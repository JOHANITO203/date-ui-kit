/* eslint-disable */
// Custom service-worker additions, imported by the Workbox-generated sw.js
// (vite-plugin-pwa workbox.importScripts). Plain JS — served as a static asset.
//
// Responsibilities:
//   - render incoming Web Push notifications
//   - focus/navigate the app when a notification is clicked
//   - relay foreground events to open clients (for in-app badges/toasts)

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Exotic';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/', kind: payload.kind || 'generic' },
    vibrate: [16, 40, 30],
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // Let any open tab update its in-app state (unread counts, etc.).
      const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientsArr) {
        client.postMessage({ type: 'push', payload });
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientsArr) {
        if ('focus' in client) {
          try {
            await client.navigate(targetUrl);
          } catch (_e) {
            /* navigate can reject if cross-origin; fall back to focus */
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
