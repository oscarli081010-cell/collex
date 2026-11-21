"use client";

import { useEffect, useRef } from "react";

/** Calls `load` again each time the section is opened again (it scrolls back into view, or the tab is shown again) and
    when the window regains focus, so what is on screen never stays as old as the first visit. Not more than once in 5 seconds. */
export function useRefresh(sectionId: string, load: () => void) {
  const latest = useRef(load);
  useEffect(() => { latest.current = load; });
  useEffect(() => {
    let last = Date.now();
    const again = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 5000) return;
      last = Date.now();
      latest.current();
    };
    const el = document.getElementById(sectionId);
    let seen = true;
    // First is "already in view or not yet"; after that, each time it comes back into view it reads again.
    const io = el && typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => { if (e.isIntersecting && !seen) again(); seen = e.isIntersecting; }) : null;
    if (el && io) { seen = false; io.observe(el); }
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", again);
    return () => { io?.disconnect(); window.removeEventListener("focus", again); document.removeEventListener("visibilitychange", again); };
  }, [sectionId]);
}
