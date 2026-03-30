// VIDA.DINHEIRO Service Worker - Network-first with auto-update
// Version is based on deployment time - each build generates a new SW
const CACHE_NAME = "vida-dinheiro-" + Date.now();

// Skip waiting immediately - take over from old SW
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Claim all clients immediately on activation + clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("vida-dinheiro-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Network-first strategy: always try network, fall back to cache
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Skip non-http requests and Supabase/API calls
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith("http")) return;
  if (url.pathname.startsWith("/auth/")) return;
  if (url.hostname.includes("supabase")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for offline fallback
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed - try cache
        return caches.match(event.request);
      })
  );
});

// Listen for messages from the app
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
