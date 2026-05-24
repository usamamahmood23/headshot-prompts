/* =============================================================================
   AI Headshot Prompt Builder — Service Worker

   Strategy:
   - Page navigations (HTML): NETWORK-FIRST so the latest app shell always loads
     when online (prevents a stale cached page from hiding updates), with a
     cached-shell fallback when offline.
   - Everything else (icons, manifest, Tailwind CDN, Google Fonts): CACHE-FIRST
     with runtime caching, so the app is fully usable offline after first load.
   ============================================================================= */

const CACHE = 'headshot-builder-v5';

// App shell + manifest + key icons precached on install. Cross-origin CDN assets
// are cached lazily at runtime to avoid addAll() failing if a CDN request errors.
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

function isNavigation(req) {
  return req.mode === 'navigate' ||
    (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first for page navigations → always get the freshest HTML online.
  if (isNavigation(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html') || caches.match('./')))
    );
    return;
  }

  // Cache-first for all other GET assets, with runtime caching.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req));
    })
  );
});
