const CACHE_NAME = 'taskflow-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './login.html',
  './habits.html',
  './style.css',
  './script.js',
  './auth.js',
  './habits.js',
  './firebase.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// ── Install: Cache static assets ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching shell assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// ── Activate: Clean up old caches ─────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ── Fetch: Stale-While-Revalidate Strategy ──────────────────────
self.addEventListener('fetch', (event) => {
  // Skip cross-origin and non-GET requests (like Firebase POSTs)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // If network is ok, update cache
          if (networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });

        // Return cached response instantly if available, else wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});
