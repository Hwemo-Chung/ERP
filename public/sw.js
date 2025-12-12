/**
 * Service Worker for offline-first application
 * Handles background sync, caching, and network interception
 */

const CACHE_NAME = 'slms-v1';
const SYNC_TAG = 'background-sync';

// Install event: cache essential files
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching essential files');
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.webmanifest',
        '/ngsw-config.json',
      ]);
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: network-first with cache fallback
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  // Skip cross-origin requests
  if (!request.url.includes(self.location.origin)) {
    return;
  }

  // Skip WebSocket
  if (request.url.startsWith('ws')) {
    return;
  }

  // API calls: network-first with cache fallback
  if (request.url.includes('/api/')) {
    return event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clonedResponse);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached response on network error
          return caches.match(request).then((cachedResponse) => {
            return (
              cachedResponse ||
              new Response(
                JSON.stringify({ error: 'Offline' }),
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({ 'Content-Type': 'application/json' }),
                }
              )
            );
          });
        })
    );
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (response.ok) {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clonedResponse);
          });
        }
        return response;
      });
    })
  );
});

// Background sync event
self.addEventListener('sync', (event: any) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === SYNC_TAG || event.tag.startsWith('sync-')) {
    event.waitUntil(
      // Notify clients to perform sync
      self.clients.matchAll().then((clients) => {
        return Promise.all(
          clients.map((client) => {
            return client.postMessage({
              type: 'BACKGROUND_SYNC',
              tag: event.tag,
            });
          })
        );
      })
    );
  }
});

// Periodic sync event (24 hour interval)
self.addEventListener('periodicsync', (event: any) => {
  console.log('[SW] Periodic sync:', event.tag);

  if (event.tag === 'periodic-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        return Promise.all(
          clients.map((client) => {
            return client.postMessage({
              type: 'PERIODIC_SYNC',
              tag: event.tag,
            });
          })
        );
      })
    );
  }
});

// Message event: handle messages from clients
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  console.log('[SW] Message:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

export {};
