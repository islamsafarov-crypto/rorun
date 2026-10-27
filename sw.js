const CACHE = "rorun-shell-v23";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./rosen-logo.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Only handle same-origin requests (the app shell). Everything else
  // (Firebase, Google Fonts, etc.) goes straight to the network so
  // live data is never served stale.
  if (url.origin !== location.origin) return;
  // Version probes from the page always go straight to the network.
  if (url.searchParams.has("v")) return;

  const isPage = e.request.mode === "navigate" || e.request.destination === "document";

  if (isPage) {
    // Network-first for the page itself, so a new deploy is picked up
    // immediately whenever there's a connection. Falls back to the
    // cached copy only when offline.
    e.respondWith(
      fetch(new Request(e.request.url, { cache: "no-cache" }))
        .then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return resp;
        })
        .catch(() => caches.match(e.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // Cache-first for static assets (icons, manifest) — these rarely change.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const network = fetch(e.request)
        .then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
