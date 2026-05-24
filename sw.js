/* =============================================================================
   AI Headshot Prompt Builder — Service Worker
   Cache-first with runtime caching so the app works fully offline after the
   first visit (including the Tailwind CDN script and Google Fonts).
   ============================================================================= */

const CACHE = 'headshot-builder-v3';

// App shell + manifest + key icons cached up-front on install. Cross-origin CDN
// assets are cached lazily at runtime (see the fetch handler) to avoid addAll()
// failing if a CDN request errors.
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Runtime-cache successful (and opaque CDN) responses for offline reuse.
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => {
          // Offline: fall back to the cached app shell for navigations.
          if (req.mode === 'navigate') return caches.match('./');
          return caches.match(req);
        });
    })
  );
});
