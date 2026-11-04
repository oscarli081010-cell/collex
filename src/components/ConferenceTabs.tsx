"use client";

import { useEffect, useRef, useState } from "react";
import { usePill } from "./usePill";
import s from "@/app/inner.module.css";

type Lenis = { scrollTo: (target: number, opts?: { duration?: number; easing?: (x: number) => number }) => void };
/** A group of related sections: its name is the main tab, its sections are the subtabs under it. */
export type TabGroup = { id: string; label: string; items: readonly (readonly [string, string])[] };

// Section navigation that follows the scroll. Three main tabs, each with the sections that belong together as subtabs
// beneath. Both rows glide a highlight to the one you're on, and the subtabs cross-fade when the group changes.
export default function ConferenceTabs({ groups }: { groups: readonly TabGroup[] }) {
  const all = groups.flatMap((g) => g.items);
  const [active, setActive] = useState(all[0][0]);
  const bar = useRef<HTMLElement>(null);
  const primary = useRef<HTMLDivElement>(null);
  const lock = useRef(0); // ignore scroll-spy while a click-scroll is in flight
  const activeGroup = groups.find((g) => g.items.some(([id]) => id === active)) ?? groups[0];
  const pill = usePill(primary, '[aria-current="true"]', activeGroup.id);

  // Where a section's heading should land: just under the bar once it is stuck to the top. Worked out from the bar's
  // stuck position and height, not from where it is now, so it's right even before the bar has reached the top.
  const below = () => {
    const el = bar.current;
    return el ? parseFloat(getComputedStyle(el).top) + el.offsetHeight + 8 : 180;
  };

  useEffect(() => {
    const onScroll = () => {
      if (Date.now() < lock.current) return;
      let current = all[0][0];
      for (const [id] of all) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - below() - 16 <= 0) current = id;
      }
      // At the very bottom the last section may never reach the top.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = all[all.length - 1][0];
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  const go = (e: React.MouseEvent, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    e.stopPropagation(); // the smooth scroller also handles #links on its own; this click is already being handled
    setActive(id);
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - below());
    // The smooth scroller drives mouse and keyboard; on a touch screen the page scrolls natively, so use the browser's own
    // (a little slower to settle, so the highlight is held a little longer).
    const lenis = (window as unknown as { __lenis?: Lenis }).__lenis;
    const smooth = Boolean(lenis) && !window.matchMedia("(pointer: coarse)").matches;
    lock.current = Date.now() + (smooth ? 1100 : 1600);
    if (smooth) lenis!.scrollTo(top, { duration: 0.9, easing: (x: number) => 1 - Math.pow(1 - x, 4) });
    else window.scrollTo({ top, behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav ref={bar} className={s.tabs} aria-label="Sections">
      <div ref={primary} className={s.groupList}>
        {groups.map((g) => (
          <a key={g.id} href={`#${g.items[0][0]}`} aria-current={activeGroup.id === g.id} onClick={(e) => go(e, g.items[0][0])}>{g.label}</a>
        ))}
        <span ref={pill} className={`t-pill ${s.tabPill}`} aria-hidden="true" />
      </div>
      <div className={s.subStack}>
        {groups.map((g) => <SubRow key={g.id} group={g} active={active} show={activeGroup.id === g.id} go={go} />)}
      </div>
    </nav>
  );
}

// One group's subtabs. Every group keeps its own row (only the current one is shown), so each row's highlight stays
// where it was and the change from one group to another is a cross-fade, not a rebuild.
function SubRow({ group, active, show, go }: { group: TabGroup; active: string; show: boolean; go: (e: React.MouseEvent, id: string) => void }) {
  const row = useRef<HTMLDivElement>(null);
  const pill = usePill(row, '[aria-current="true"]', active);

  // On a narrow screen the row can scroll sideways; keep the current subtab in view.
  useEffect(() => {
    const r = row.current;
    const el = r?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!show || !r || !el) return;
    r.scrollTo({ left: el.offsetLeft - (r.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [active, show]);

  return (
    <div ref={row} role="group" className={s.subRow} data-show={show} inert={!show} aria-label={`${group.label} sections`}>
      {group.items.map(([id, label]) => (
        <a key={id} href={`#${id}`} aria-current={active === id} onClick={(e) => go(e, id)}>{label}</a>
      ))}
      <span ref={pill} className={`t-pill ${s.subPill}`} aria-hidden="true" />
    </div>
  );
}
