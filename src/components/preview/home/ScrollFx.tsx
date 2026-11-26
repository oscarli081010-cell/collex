"use client";

import { useEffect } from "react";

// The page's scroll motion is CSS (scroll-driven animations). A browser without them gets this instead: each part marked
// data-rise fades up once as it comes into view. Nothing is hidden unless this runs, so without script, or with reduced
// motion, everything is simply there.
export default function ScrollFx() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (CSS.supports("animation-timeline: view()")) return;
    const root = document.documentElement;
    root.classList.add("pfx");
    const io = new IntersectionObserver((list) => {
      for (const e of list) if (e.isIntersecting) { e.target.setAttribute("data-in", ""); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -12% 0px" });
    // Only what this has claimed is hidden, so anything that renders later (the Coming up rows) simply shows.
    document.querySelectorAll("[data-rise]").forEach((el) => { el.setAttribute("data-wait", ""); io.observe(el); });
    return () => { io.disconnect(); root.classList.remove("pfx"); };
  }, []);
  return null;
}
