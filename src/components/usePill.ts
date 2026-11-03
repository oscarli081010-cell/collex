"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Slides an absolutely positioned indicator under the active child of `container`.
 * The first placement (and placements after a resize) skip the transition, so the pill
 * never animates in from the left edge.
 */
export function usePill(container: RefObject<HTMLElement | null>, activeSelector: string, dep: unknown) {
  const pill = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const box = container.current;
    const el = pill.current;
    if (!box || !el) return;

    // Where the pill was last put. A re-fit that finds nothing has moved must leave it alone: writing the same
    // position with the transition off would cut a slide that has just started.
    let at = "";
    const place = (instant: boolean) => {
      const active = box.querySelector<HTMLElement>(activeSelector);
      if (!active) { el.style.opacity = "0"; at = ""; return; }
      const b = box.getBoundingClientRect();
      const a = active.getBoundingClientRect();
      const now = `${a.width}|${a.left - b.left + box.scrollLeft}`;
      if (instant && now === at) return;
      at = now;
      if (instant) el.style.transition = "none";
      el.style.opacity = "1";
      el.style.width = `${a.width}px`;
      el.style.transform = `translateX(${a.left - b.left + box.scrollLeft}px)`;
      if (instant) { void el.offsetWidth; el.style.transition = ""; }
    };

    place(!placed.current);
    placed.current = true;
    const onResize = () => place(true);
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(() => place(true));
    // Tabs can change width after the first paint, e.g. when a count badge loads in, or when a hidden panel is shown.
    const ro = new ResizeObserver(() => place(true));
    box.querySelectorAll(":scope > *").forEach((child) => child !== el && ro.observe(child));
    return () => { window.removeEventListener("resize", onResize); ro.disconnect(); };
  }, [container, activeSelector, dep]);

  return pill;
}
