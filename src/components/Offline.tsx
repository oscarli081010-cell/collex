"use client";

import { useEffect } from "react";

/** Registers the service worker that lets Committees open without a connection. Only on the real site, never in development. */
export default function Offline() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || location.hostname === "localhost" || location.hostname === "127.0.0.1") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
