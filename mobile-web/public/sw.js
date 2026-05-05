// Cache name — bump to invalidate all cached assets
const CACHE = 'rondello-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Pass API calls straight through — never cache
  if (url.includes('bubbleapps') || url.includes('rondellobuffet')) return;

  // Immutable hashed assets (/assets/xxx-HASH.js|css) — cache-first forever
  if (url.includes('/assets/')) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(e.request).then(
          (cached) =>
            cached ||
            fetch(e.request).then((res) => {
              cache.put(e.request, res.clone());
              return res;
            })
        )
      )
    );
    return;
  }

  // HTML / navigation — network-first so new deploys are picked up immediately
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
