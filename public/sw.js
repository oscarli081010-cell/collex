// Collex's service worker. It exists so a chair's console still opens when the room's wifi drops:
//  - a page you have opened before is shown from the last copy when the network can't be reached;
//  - the site's own scripts, styles, fonts and flags are kept, since their addresses change whenever they do.
// It never keeps anything from Supabase or any other site, and never answers a request that isn't a plain GET.
// The caches are named for the build (?v= on this script's address), so a new build starts clean and the old copies are
// deleted. Whenever anything here goes wrong, the request simply goes to the network, as if there were no worker.
const V = new URL(self.location.href).searchParams.get("v") || "";
const TAG = V ? V.replace(/[^\w.-]/g, "").slice(0, 40) : "v1";
const PAGES = `collex-pages-${TAG}`;
const ASSETS = `collex-assets-${TAG}`;
const kept = (path) => path.startsWith("/_next/static/") || path.startsWith("/flags/");
// The pages it keeps for offline: the committee pages, and the home page the installed app opens on. Any other page is
// left entirely to the browser.
const page = (path) => path === "/" || path === "/chambers" || path.startsWith("/chambers/");

// Nothing is fetched ahead at install: a page kept without the scripts it names would open blank. A page is kept when it
// is opened (its scripts come through here as it loads) or when it sends its addresses (below), never on its own.
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== PAGES && k !== ASSETS).map((k) => caches.delete(k)))).catch(() => {}).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Hashed build files and flags never change at the same address: keep them, and use the kept copy first.
  if (kept(url.pathname)) {
    e.respondWith((async () => {
      try {
        const hit = await (await caches.open(ASSETS)).match(req);
        if (hit) return hit;
      } catch { /* no cache: the network it is */ }
      const res = await fetch(req);
      if (res.ok) { const copy = res.clone(); caches.open(ASSETS).then((c) => c.put(req, copy)).catch(() => {}); }
      return res;
    })());
    return;
  }

  // A page: always the network first, so nothing is ever stale while online. The last copy is only for when it fails.
  if (req.mode === "navigate" && page(url.pathname)) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok && !res.redirected) {
        const copy = res.clone();
        caches.open(PAGES).then((c) => c.put(url.pathname, copy)).catch(() => {});
      }
      return res;
    }).catch(async () => {
      try { return (await caches.match(url.pathname, { cacheName: PAGES })) || (url.pathname !== "/" && (await caches.match("/chambers", { cacheName: PAGES }))) || Response.error(); }
      catch { return Response.error(); }
    }));
  }
});

// A committee page, once open, sends the addresses of the scripts and styles it loaded (and its own path), so they are
// all kept at once rather than only as each is next asked for. The answer says whether everything is now kept.
self.addEventListener("message", (e) => {
  const d = e.data;
  const port = e.ports && e.ports[0];
  if (!d || d.type !== "keep" || !Array.isArray(d.urls)) return;
  e.waitUntil((async () => {
    let ok = true;
    try {
      const assets = await caches.open(ASSETS);
      await Promise.all(d.urls.slice(0, 400).map(async (u) => {
        if (typeof u !== "string") return;
        const url = new URL(u, self.location.origin);
        if (url.origin !== self.location.origin || !kept(url.pathname)) return;
        if (await assets.match(url.href)) return;
        const res = await fetch(url.href);
        if (res.ok) await assets.put(url.href, res); else ok = false;
      }));
      // The page itself only once every script it named is kept, so a kept page never names a script that isn't.
      if (ok && typeof d.page === "string" && page(d.page)) {
        const pages = await caches.open(PAGES);
        if (!(await pages.match(d.page))) {
          const res = await fetch(d.page);
          if (res.ok) await pages.put(d.page, res); else ok = false;
        }
      }
    } catch { ok = false; }
    if (port) port.postMessage({ ok });
  })());
});
