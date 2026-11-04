"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

// Smooth scrolling. Entrance animations are plain CSS (motion.css), so this is the only script behind the motion.
export default function Motion() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    root.classList.add("motion");

    const lenis = new Lenis({ lerp: 0.1, anchors: { offset: -80 } });
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
