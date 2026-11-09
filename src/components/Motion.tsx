"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

// Smooth scrolling. Entrance animations are plain CSS (motion.css), so this is the only script behind the motion.
// A wheel over something that scrolls by itself (a drop-down, the list of co-sponsors) scrolls that, not the page behind it.
const inScroller = (node: Element | null) => {
  for (let el = node; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const o = getComputedStyle(el).overflowY;
    if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight + 1) return true;
  }
  return false;
};

export default function Motion() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    root.classList.add("motion");

    const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -80 }, prevent: inScroller });
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis; // used by in-page tabs and the scroll lock
    let frame = requestAnimationFrame(function tick(time) {
      lenis.raf(time);
      frame = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
      root.classList.remove("motion");
    };
  }, [pathname]);

  return null;
}
