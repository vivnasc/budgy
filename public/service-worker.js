// BUDGY Service Worker - Network-first with offline support
const CACHE_NAME = "budgy-v3-" + Date.now();
const STATIC_CACHE = "budgy-static-v2";

// Static assets to pre-cache for offline use
const PRECACHE_URLS = [
  "/",
  "/painel",
  "/transacoes",
  "/contas",
  "/importar",
  "/orcamento",
  "/metas",
  "/manifest.json",
  "/favicon.svg",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// Skip waiting immediately - take over from old SW
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        // Silently fail if pre-caching fails (e.g., during build)
      })
    )
  );
  self.skipWaiting();
});

// Claim all clients immediately on activation + clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Network-first strategy with enhanced offline fallback
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip non-http requests, auth endpoints, and Supabase API calls
  if (!url.protocol.startsWith("http")) return;
  if (url.pathname.startsWith("/auth/")) return;
  if (url.hostname.includes("supabase")) return;

  // API routes - network only, no caching
  if (url.pathname.startsWith("/api/")) return;

  // For page navigation requests - try network, fall back to cache, then offline page
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) =>
            cached || caches.match("/painel") || new Response(
              "<html><body style='font-family:sans-serif;text-align:center;padding:4em'>" +
              "<h1>BUDGY</h1><p>Sem ligação à internet</p>" +
              "<p style='color:#999'>Os teus dados estão guardados localmente.</p>" +
              "</body></html>",
              { headers: { "Content-Type": "text/html" } }
            )
          )
        )
    );
    return;
  }

  // Static assets (JS, CSS, images) - cache-first, then network
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
      )
    );
    return;
  }

  // Everything else - network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Listen for messages from the app
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }

  // Sync when back online
  if (event.data === "sync") {
    // Notify all clients to trigger sync
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: "SYNC_READY" });
      });
    });
  }
});

// Background sync when connectivity is restored
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-transactions") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "SYNC_TRANSACTIONS" });
        });
      })
    );
  }
});
