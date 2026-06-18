// RoyalWin Service Worker v2
// Network-first for index.html so updates deploy immediately to all users.
// Cache-first for static assets (fonts, icons) that rarely change.

const CACHE_NAME = 'royalwin-v2';
const STATIC_ASSETS = [
  '/royalwin/manifest.json',
  '/royalwin/favicon.svg',
  '/royalwin/favicon.ico'
];

// Install: pre-cache static assets only (NOT index.html)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate: delete old caches so stale content is never served
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always network-only for API calls, Firebase, CDNs
  if (
    url.hostname.includes('vercel.app') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('cdnjs') ||
    url.hostname.includes('fonts.g')
  ) {
    return;
  }

  // Network-first for index.html and navigation requests
  // This ensures users always get the latest version after each deploy
  if (event.request.mode === 'navigate' ||
      url.pathname === '/royalwin/' ||
      url.pathname === '/royalwin/index.html') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the fresh response for offline fallback
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Only fall back to cache if completely offline
          return caches.match(event.request) || caches.match('/royalwin/index.html');
        })
    );
    return;
  }

  // Cache-first for other static assets (icons, manifest)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
