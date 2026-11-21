"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Counts page views and reports faults. It draws nothing, sets no cookie and sends no address, account or device identifier:
// only the page's path (the database drops anything after "?"), and for a fault its message, stack and browser name.

// Not worth counting: a developer's own machine, and automated browsers (tests, crawlers that say so).
const skip = () => !supabase || typeof window === "undefined" || ["localhost", "127.0.0.1"].includes(location.hostname) || navigator.webdriver === true;

// Browser quirks and extensions that are not faults in Collex.
const NOISE = /ResizeObserver loop|Script error\.|(chrome|moz|safari)-extension:\/\//;
const MAX_REPORTS = 5;
// What has been reported since this page loaded, so one fault in a loop is sent once and a broken page cannot flood the log.
const sent = new Set<string>();

/** Sends one fault to the Admin page's error list. Never throws, and sends nothing twice from the same page load. */
export function reportError(message: unknown, stack?: unknown, extra = "") {
  try {
    if (skip() || sent.size >= MAX_REPORTS) return;
    const text = String(message ?? "").trim();
    const trace = `${typeof stack === "string" ? stack : ""}${extra}`;
    if (!text || sent.has(text) || NOISE.test(text) || NOISE.test(trace)) return;
    sent.add(text);
    Promise.resolve(supabase!.rpc("report_error", { message: text, stack: trace, page: location.pathname, agent: navigator.userAgent })).catch(() => {});
  } catch { /* reporting a fault must never cause one */ }
}

export default function Pulse() {
  const pathname = usePathname();

  useEffect(() => {
    if (skip()) return;
    // The first page view in this browser tab counts as a visit; the rest of the tab's views only count as views.
    // If storage is blocked we cannot tell, so we count the view alone.
    let first = false;
    try {
      if (!sessionStorage.getItem("collex-seen")) { sessionStorage.setItem("collex-seen", "1"); first = true; }
    } catch { /* storage can be blocked */ }
    try { Promise.resolve(supabase!.rpc("hit", { page: pathname, first })).catch(() => {}); } catch { /* a counter must never break a page */ }
  }, [pathname]);

  useEffect(() => {
    const onError = (e: ErrorEvent) => reportError(e.message || e.error?.message, e.error?.stack, e.filename ? `\n${e.filename}` : "");
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      reportError(r instanceof Error ? r.message : typeof r === "string" ? r : r?.message ?? "Unhandled promise rejection", r?.stack);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);

  return null;
}
