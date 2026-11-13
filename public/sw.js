/* Cache only the public offline message. Private records and authenticated HTML
   are never stored by this worker. In-app pending edits have a separate journal. */
const CACHE = 'repbook-public-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add('/offline.html')));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('repbook-public-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
});

/* Every received push produces a visible notification, as required by Safari.
   The server cancels superseded timers before delivery; no hidden timer runs here.
   Notification content never includes personal workout, gym, or photo details. */
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Safe generic fallback. */ }
  const timerId = typeof payload.timerId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(payload.timerId) ? payload.timerId : 'rest';
  const endsAt = typeof payload.endsAt === 'number' && Number.isFinite(payload.endsAt) ? payload.endsAt : null;
  const late = endsAt !== null && Date.now() - endsAt > 60_000;
  event.waitUntil(self.registration.showNotification('Repbook', {
    body: late ? 'Your earlier rest timer ended. Open Repbook to check your current set.' : "You're ready for your next set!",
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `repbook-rest-${timerId}`,
    data: { type: 'repbook-rest-ready', timerId },
    ...(endsAt === null ? {} : { timestamp: endsAt }),
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    // Always open our app; do not navigate to any URL supplied by a push payload.
    const root = new URL('/', self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => {
      try { return new URL(client.url).origin === self.location.origin; } catch { return false; }
    });
    if (existing) await existing.focus();
    else await self.clients.openWindow(root);
  })());
});
