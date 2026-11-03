"use client";

import { useEffect, useRef, useState } from "react";
import { usePill } from "./usePill";
import s from "@/app/inner.module.css";

type Lenis = { scrollTo: (target: HTMLElement, opts?: { offset?: number }) => void };
const OFFSET = 140; // top bar + sticky tabs

// Section tabs that follow the scroll and glide to a section on click.
export default function ConferenceTabs({ tabs }: { tabs: readonly (readonly [string, string])[] }) {
  const [active, setActive] = useState(tabs[0][0]);
  const list = useRef<HTMLUListElement>(null);
  const pill = usePill(list, '[aria-current="true"]', active);
  const lock = useRef(0); // ignore scroll-spy while a click-scroll is in flight

  useEffect(() => {
    const onScroll = () => {
      if (Date.now() < lock.current) return;
      let current = tabs[0][0];
      for (const [id] of tabs) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - OFFSET - 40 <= 0) current = id;
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
    setActive(id);
    lock.current = Date.now() + 900;
    const lenis = (window as unknown as { __lenis?: Lenis }).__lenis;
    if (lenis) lenis.scrollTo(el, { offset: -OFFSET + 8 });
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - OFFSET + 8, behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav className={s.tabs} aria-label="Sections">
      <ul ref={list}>
        {tabs.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`} aria-current={active === id} onClick={(e) => go(e, id)}>{label}</a>
          </li>
        ))}
        <span ref={pill} className={`t-pill ${s.tabPill}`} aria-hidden="true" />
      </ul>
    </nav>
  );
}
