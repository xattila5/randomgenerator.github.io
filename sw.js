const CACHE = 'sal-v3';
const PRECACHE = [
  '/splash.html', '/index.html', '/idojaras.html', '/hirek.html',
  '/cikk.html', '/befektetes.html', '/grafikon.html',
  '/styles.css', '/effects.js', '/nav.js', '/script.js',
  '/idojaras.js', '/hirek.js', '/cikk.js', '/befektetes.js', '/grafikon.js',
  '/weather-canvas.js', '/notifications.js',
  '/icon.svg', '/icon-maskable.svg', '/manifest.json', '/SAL_Logo.svg.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { pathname } = new URL(e.request.url);
  // Network-first: API calls and external resources
  if (pathname.startsWith('/api/') || pathname.includes('netlify/functions') ||
      e.request.url.includes('googleapis') || e.request.url.includes('open-meteo')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // Cache-first: static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});

// Receive message from page → show notification
self.addEventListener('message', e => {
  if (e.data?.type !== 'NOTIFY') return;
  const { title, body, url } = e.data;
  self.registration.showNotification(title, {
    body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: url || '/hirek.html' },
    tag: 'sal-news',
    renotify: true,
  });
});

// Notification click → focus or open the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.data?.url || '/hirek.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.endsWith(target) && 'focus' in w) return w.focus();
      }
      return clients.openWindow(target);
    })
  );
});
