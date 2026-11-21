"use client";

import { useEffect, useState } from "react";

// The build this page came from, so the worker names its caches for it and a new build starts clean. Vercel sets one of
// these; without either, the worker keeps one set of caches as it always did.
const BUILD = process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "";
const local = () => location.hostname === "localhost" || location.hostname === "127.0.0.1";

/** Registers the service worker that lets Committees open without a connection. Only on the real site, never in development. */
export default function Offline() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || local()) return;
    navigator.serviceWorker.register(BUILD ? `/sw.js?v=${encodeURIComponent(BUILD)}` : "/sw.js").catch(() => {});
  }, []);
  return null;
}

export type OfflineState = "checking" | "ready" | "not" | "none";
/** Keeps everything this committee page loaded, so it opens again without wifi, and says whether that worked.
    "none": there is no worker here (development, or a browser without one), so nothing is shown. */
export function useOfflineReady(): OfflineState {
  const [st, setSt] = useState<OfflineState>("checking");
  useEffect(() => {
    if (!("serviceWorker" in navigator) || local()) { setSt("none"); return; }
    let live = true;
    const give = (v: OfflineState) => { if (live) setSt(v); };
    const stop = setTimeout(() => give("not"), 20_000);
    const send = (sw: ServiceWorker | null | undefined) => {
      if (!sw) { give("not"); return; }
      const urls = new Set<string>();
      for (const e of performance.getEntriesByType("resource")) urls.add(e.name);
      document.querySelectorAll<HTMLScriptElement>("script[src]").forEach((x) => urls.add(x.src));
      document.querySelectorAll<HTMLLinkElement>("link[rel=stylesheet][href], link[rel=preload][href]").forEach((x) => urls.add(x.href));
      const ch = new MessageChannel();
      ch.port1.onmessage = (m) => { clearTimeout(stop); give(m.data?.ok ? "ready" : "not"); };
      sw.postMessage({ type: "keep", urls: [...urls].filter((u) => u.startsWith(location.origin + "/_next/static/")), page: location.pathname }, [ch.port2]);
    };
    navigator.serviceWorker.ready.then((reg) => send(navigator.serviceWorker.controller ?? reg.active)).catch(() => give("not"));
    // A new build's worker takes over this page and starts with empty caches (the last build's are deleted), so this
    // page's scripts are sent again to the new worker; otherwise it would keep a page whose scripts it doesn't have.
    const swap = () => send(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", swap);
    return () => { live = false; clearTimeout(stop); navigator.serviceWorker.removeEventListener("controllerchange", swap); };
  }, []);
  return st;
}
