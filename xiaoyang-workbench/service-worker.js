const CACHE_NAME = "little-sheep-workbench-v35";
const APP_FILES = [
  "./",
  "./ai-workbench.html",
  "./manifest.webmanifest",
  "./assets/lucide.min.js",
  "./assets/bench-character-bg.jpg",
  "./assets/bench-character-watermark.png",
  "./assets/app-icon-192.png",
  "./assets/app-icon-512.png",
  "./assets/sheep-mist-bg-lite.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
    )
  );
});
