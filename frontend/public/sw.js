// Sabi Intelligence Suite - PWA Service Worker (cache-safety rewrite)
//
// Goal: every deploy is visible without a hard refresh.
//   * Navigations (HTML pages) -> network-first, cache only as offline fallback.
//   * Static assets (_next/static, images) -> stale-while-revalidate.
//   * API requests (/api/*) -> never cached, always network.
//   * Old cache versions pruned, newest kept so background updates are safe.

const CACHE_NAME = 'sabi-v2';
const MAX_CACHES = 3;

// CORE_ASSETS support offline mode. They are never served cache-first,
// so fresh deploys still appear immediately.
const CORE_ASSETS = [
  '/',
  '/login',
  '/set-password',
  '/accept-invite',
  '/client/login',
  '/client/dashboard',
  '/client/goals',
  '/client/deliverables',
  '/client/tasks',
  '/dashboard',
  '/my-brands',
  '/my-profile',
  '/my-work',
  '/brands',
  '/people',
  '/notifications',
  '/calendar',
  '/reports',
  '/manifest.json',
  '/sabi_logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// -- Install: pre-cache the shell (failure is non-fatal) --
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_ASSETS);
    }).catch(function (err) {
      console.error('[SW] pre-cache failed:', err);
    })
  );
  self.skipWaiting();
});

// -- Activate: delete old cache versions --
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      var stale = keys.filter(function (k) {
        return k !== CACHE_NAME;
      }).sort();
      var keep = Math.max(1, MAX_CACHES - 1);
      var toDelete = stale.slice(0, Math.max(0, stale.length - keep));
      return Promise.all(toDelete.map(function (k) { return caches.delete(k); }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// -- Message handling: allow the app to request immediate activation --
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// -- Fetch: the caching policy --
self.addEventListener('fetch', function (event) {
  var request = event.request;

  // Only handle GET requests.
  if (request.method !== 'GET') return;

  // Only handle same-origin requests. The API lives on a different
  // origin (e.g. localhost:4000 or your API subdomain), so it is skipped.
  if (!request.url.startsWith(self.location.origin)) return;

  // Never cache API responses - always go to the network.
  if (request.url.indexOf('/api/') !== -1) return;

  // HTML page navigations: network-first so new deploys are visible
  // immediately. Falls back to the cached copy only when offline.
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').indexOf('text/html') !== -1) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(request));
});

function networkFirst(request) {
  return fetch(request).then(function (response) {
    if (response && response.status === 200 && response.type === 'basic') {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function (cache) { return cache.put(request, clone); });
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      if (cached) return cached;
      return new Response('Offline - please check your connection.', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'Content-Type': 'text/plain' })
      });
    });
  });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(function (cached) {
    var networkPromise = fetch(request).then(function (response) {
      if (response && response.status === 200 && response.type === 'basic') {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { return cache.put(request, clone); });
      }
      return response;
    }).catch(function () {
      return cached;
    });
    return cached || networkPromise;
  });
}

// -- Push notifications --
self.addEventListener('push', function (event) {
  var data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Sabi Intelligence Suite', {
      body: data.body || 'You have a new notification.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});