"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type Lenis from "lenis";

// Smooth scrolling. Entrance animations are plain CSS (motion.css), so this is the only script behind the motion.
// The scroller itself (Lenis) is loaded only once it is wanted: when the browser is idle, or at the first scroll, key or tap.
// A wheel over something that scrolls by itself (a drop-down, the list of co-sponsors) scrolls that, not the page behind it.
const inScroller = (node: Element | null) => {
  for (let el = node; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const o = getComputedStyle(el).overflowY;
    if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight + 1) return true;
  }
  return false;
};

// A tip's text lives in CSS (::after), which a screen reader never sees. So each tip also gets the same words in a hidden
// element, and the control inside it points at that element with aria-describedby. Done once per tip; kept in step when the
// words change. A control whose own name already says it (an icon button named like its tip) is left alone.
const TIPS = '.tip[data-tip]:not([data-tip=""])';
const plain = (s: string) => s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim();
let tipId = 0;
function describeTip(tip: Element) {
  const text = tip.getAttribute("data-tip") ?? "";
  let note = tip.querySelector<HTMLElement>(":scope > [data-tip-note]");
  const control = tip.matches("[tabindex]") ? tip : tip.querySelector<HTMLElement>("button, a[href], input, select, textarea, [tabindex]");
  const said = control ? plain(`${control.getAttribute("aria-label") ?? ""} ${control.textContent ?? ""}`) : plain(tip.textContent ?? "");
  const redundant = !text || !control || (tip.hasAttribute("data-tip-self")) || said.includes(plain(text));
  if (redundant) {
    if (note && !tip.hasAttribute("data-tip-self")) { forget(control, note.id); note.remove(); }
    return;
  }
  if (!note) {
    note = document.createElement("span");
    note.id = `tip-note-${++tipId}`;
    note.className = "sr-only";
    note.setAttribute("data-tip-note", "");
    note.setAttribute("aria-hidden", "true"); // read through aria-describedby, not twice in the page text
    tip.appendChild(note);
  }
  if (note.textContent !== text) note.textContent = text;
  const ids = (control!.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  if (!ids.includes(note.id)) control!.setAttribute("aria-describedby", [...ids, note.id].join(" "));
}
function forget(control: Element | null, id: string) {
  if (!control) return;
  const rest = (control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((x) => x && x !== id);
  if (rest.length) control.setAttribute("aria-describedby", rest.join(" ")); else control.removeAttribute("aria-describedby");
}

export default function Motion() {
  const pathname = usePathname();

  // The skip link's target must be focusable for Safari to move focus there (it is not a control, so it takes no ring).
  // Set when the link is used, not on load: an attribute added before React has hydrated the page is a hydration mismatch.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('a.skip, a[href="#top"]')) document.getElementById("top")?.setAttribute("tabindex", "-1");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Tips for screen readers (see above), and Escape to put one away without moving the pointer or focus.
  useEffect(() => {
    const sweep = (root: ParentNode) => root.querySelectorAll(TIPS).forEach(describeTip);
    sweep(document);
    const watch = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "attributes") { const tip = (m.target as Element).closest(".tip"); if (tip) describeTip(tip); continue; }
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          const el = n as Element;
          if (el.matches(TIPS)) describeTip(el);
          sweep(el);
        });
      }
    });
    watch.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-tip", "aria-describedby", "aria-label"] });
    const shown = '.tip:hover, .tip:has(:focus-visible), .tip[data-tip-open], .tip[data-tip-show]';
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll(shown).forEach((tip) => { tip.setAttribute("data-tip-dismissed", ""); tip.removeAttribute("data-tip-show"); });
    };
    const reset = (e: Event) => {
      const t = (e.target as Element | null)?.closest?.(".tip[data-tip-dismissed]");
      const to = (e as PointerEvent | FocusEvent).relatedTarget as Node | null;
      if (t && !(to && t.contains(to))) t.removeAttribute("data-tip-dismissed");
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerout", reset);
    document.addEventListener("focusout", reset);
    return () => { watch.disconnect(); document.removeEventListener("keydown", key); document.removeEventListener("pointerout", reset); document.removeEventListener("focusout", reset); };
  }, []);

  // Phones don't hover and a disabled button can't be focused, so tapping a tip shows its reason for a few seconds.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let shown: Element | null = null;
    const hide = () => { shown?.removeAttribute("data-tip-show"); shown = null; };
    const tap = (e: MouseEvent) => {
      const tip = (e.target as Element | null)?.closest?.('.tip[data-tip]:not([data-tip=""])') ?? null;
      clearTimeout(timer);
      if (shown !== tip) hide();
      // Only where the reason can't be reached another way: around a control that is off, or on a touch screen.
      if (!tip || !(tip.querySelector(':disabled, [aria-disabled="true"]') || window.matchMedia("(pointer: coarse)").matches)) return;
      tip.setAttribute("data-tip-show", "");
      shown = tip;
      timer = setTimeout(hide, 3500);
    };
    document.addEventListener("click", tap);
    return () => { document.removeEventListener("click", tap); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    root.classList.add("motion");

    let lenis: Lenis | undefined;
    let frame = 0;
    let gone = false;
    const wake = ["wheel", "keydown", "pointerdown", "touchstart"] as const;
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1500));
    const unidle = window.cancelIdleCallback ?? window.clearTimeout;
    let idleId = 0;
    const start = async () => {
      wake.forEach((e) => window.removeEventListener(e, start));
      unidle(idleId);
      if (lenis || gone) return;
      const { default: Smooth } = await import("lenis");
      if (gone || lenis) return;
      lenis = new Smooth({ lerp: 0.1, anchors: { offset: -80 }, prevent: inScroller });
      (window as unknown as { __lenis?: Lenis }).__lenis = lenis; // used by in-page tabs and the scroll lock
      frame = requestAnimationFrame(function tick(time) {
        lenis!.raf(time);
        frame = requestAnimationFrame(tick);
      });
    };
    wake.forEach((e) => window.addEventListener(e, start, { once: true, passive: true }));
    idleId = idle(start, { timeout: 4000 }) as number;

    return () => {
      gone = true;
      wake.forEach((e) => window.removeEventListener(e, start));
      unidle(idleId);
      cancelAnimationFrame(frame);
      lenis?.destroy();
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
      root.classList.remove("motion");
    };
  }, [pathname]);

  return null;
}
