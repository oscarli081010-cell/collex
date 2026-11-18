// Collex's service worker. It exists so a chair's console still opens when the room's wifi drops:
//  - a page you have opened before is shown from the last copy when the network can't be reached;
//  - the site's own scripts, styles, fonts and flags are kept, since their addresses change whenever they do.
// It never keeps anything from Supabase or any other site, and never answers a request that isn't a plain GET.
const PAGES = "collex-pages-v1";
const ASSETS = "collex-assets-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(["/chambers", "/chambers/display"]).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== PAGES && k !== ASSETS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Hashed build files and flags never change at the same address: keep them, and use the kept copy first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/flags/")) {
    e.respondWith(caches.open(ASSETS).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // A page: always the network first, so nothing is ever stale while online. The last copy is only for when it fails.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok && (url.pathname.startsWith("/chambers") || url.pathname === "/")) {
        const copy = res.clone();
        caches.open(PAGES).then((c) => c.put(url.pathname, copy));
      }
      return res;
    }).catch(async () => (await caches.match(url.pathname, { cacheName: PAGES })) || (await caches.match("/chambers", { cacheName: PAGES })) || Response.error()));
  }
});
