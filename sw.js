const CACHE_NAME = 'streak-calendar-v8';

const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/calendar.js',
  '/js/storage.js',
  '/js/notifications.js',
  '/assets/icon.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/apple-touch-icon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('Some assets could not be pre-cached:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // For HTML navigation requests (opening app / navigating pages)
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback
          const cached = await caches.match('/index.html') || await caches.match('/') || await caches.match('./index.html');
          if (cached) return cached;
          return new Response('Offline - App ready on reload', {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // For static assets (CSS, JS, Images, Icons)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Fetch in background to update cache
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(event.request).catch(async () => {
        return caches.match(event.request);
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
            break;
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
