// RoyalWin Service Worker
// Provides offline support and makes the app installable as a PWA.
// Strategy: cache-first for static assets, network-first for API calls.

const CACHE_NAME = 'royalwin-v1';
const STATIC_ASSETS = [
  '/royalwin/',
  '/royalwin/index.html',
  '/royalwin/manifest.json',
  '/royalwin/favicon.svg',
  '/royalwin/favicon.ico'
];

// Install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Silently ignore individual asset failures (e.g. favicon.ico missing)
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API/Firebase calls, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always go to network for API calls, Firebase, and external CDNs
  if (
    url.hostname.includes('vercel.app') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firebaseio') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('cdnjs') ||
    url.hostname.includes('fonts.g')
  ) {
    return; // let browser handle normally
  }

  // Cache-first for same-origin static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // If both cache and network fail, return the cached index for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/royalwin/index.html');
        }
      });
    })
  );
});
