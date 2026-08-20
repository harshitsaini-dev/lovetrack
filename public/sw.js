/**
 * LoveTrack service worker.
 *
 * Scope is deliberately narrow: make the app installable and show a useful
 * screen when the network is gone. It does NOT cache attendance pages or
 * API responses.
 *
 * That restraint is the point. Serving a stale dashboard would show
 * yesterday's check-in as though it were today's, and caching a capture
 * request could replay it later — the nonce would reject it, but the user
 * would have been told something untrue in the meantime. Anything that
 * depends on server time or verification must reach the server or fail
 * honestly.
 */

const VERSION = "v1";
const SHELL_CACHE = `lovetrack-shell-${VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/manifest.json", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one missing file does not fail the whole install.
      .then((cache) =>
        Promise.allSettled(PRECACHE.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("lovetrack-") && key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only page navigations are handled. Everything else — including every
  // Supabase call and every server action — goes straight to the network.
  if (request.mode !== "navigate" || request.method !== "GET") return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(SHELL_CACHE);
      const offline = await cache.match(OFFLINE_URL);

      return (
        offline ??
        new Response("Aap offline hain.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      );
    }),
  );
});
