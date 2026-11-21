"use client";

import { useEffect, useRef, useState } from "react";
import { usePill } from "./usePill";
import s from "@/app/inner.module.css";

type Lenis = { scrollTo: (target: number, opts?: { duration?: number; easing?: (t: number) => number }) => void };

// Section tabs that follow the scroll and glide to a section on click.
const msFromNow = (ms: number) => Date.now() + ms; // read when a tab is clicked, not while the page draws

export default function ConferenceTabs({ tabs }: { tabs: readonly (readonly [string, string])[] }) {
  const [active, setActive] = useState(tabs[0][0]);
  const bar = useRef<HTMLElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const pill = usePill(list, '[aria-current="true"]', active);
  const lock = useRef(0); // ignore scroll-spy while a click-scroll is in flight

  // Where a section's top should land: just under the top bar and these tabs once they're stuck.
  const below = () => {
    const el = bar.current;
    return el ? parseFloat(getComputedStyle(el).top) + el.offsetHeight + 8 : 140;
  };

  useEffect(() => {
    const onScroll = () => {
      if (Date.now() < lock.current) return;
      let current = tabs[0][0];
      for (const [id] of tabs) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - below() - 16 <= 0) current = id;
      }
      // At the very bottom the last section may never reach the top.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = tabs[tabs.length - 1][0];
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tabs]);

  // Keep the active tab in view on narrow screens where the row scrolls sideways.
  // Only the row scrolls: scrollIntoView would also move the page when the row is near the bottom of a phone screen.
  useEffect(() => {
    const row = list.current;
    const tab = row?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!row || !tab) return;
    row.scrollTo({ left: tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  const go = (e: React.MouseEvent, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation(); // the smooth scroller also handles #links on its own; this click is already being handled
    setActive(id);
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - below());
    // The smooth scroller drives mouse and keyboard; on a touch screen the page scrolls natively, so use the browser's own.
    const lenis = (window as unknown as { __lenis?: Lenis }).__lenis;
    const smooth = Boolean(lenis) && !window.matchMedia("(pointer: coarse)").matches;
    lock.current = msFromNow(smooth ? 1100 : 1600);
    if (smooth) lenis!.scrollTo(top, { duration: 0.9, easing: (x: number) => 1 - Math.pow(1 - x, 4) });
    else window.scrollTo({ top, behavior: "smooth" });
    // The browser's own replaceState: the router's wrapper would treat this as a navigation and re-render the page.
    History.prototype.replaceState.call(history, history.state, "", `#${id}`);
  };

  return (
    <nav ref={bar} className={s.tabs} aria-label="Sections">
      <ul ref={list}>
        {tabs.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`} aria-current={active === id} onClick={(e) => go(e, id)}>{label}</a>
          </li>
        ))}
        {/* The sliding underline sits in a list item of its own (a <span> can't be a direct child of a <ul>); the item has no box. */}
        <li className={s.pillItem} aria-hidden="true"><span ref={pill} className={`t-pill ${s.tabPill}`} /></li>
      </ul>
    </nav>
  );
}
