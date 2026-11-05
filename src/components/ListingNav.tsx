"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { ICONS } from "./IconButton";
import s from "@/app/auth.module.css";

export type ListingView = "activity" | "edit";
const LAST = "collex:listing-tab";

// A listing's Activity and edit form, one tap apart on the same sliding control as the account and edit tabs, with a
// button beside it to the listing's public page once it's live. Edit is only there for the people who can edit.
//
// Each page is its own route, so the control is rebuilt on every switch. To keep it feeling like one control, the
// highlight starts on the tab you came from and slides to this one, and the page itself plays no entrance (see motion.css).
export default function ListingNav({ id, slug, current, live, canEdit }: { id: string; slug: string; current: ListingView; live: boolean; canEdit: boolean }) {
  const box = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const items = [
    { id: "activity" as const, label: "Activity", href: `/activity?id=${id}`, icon: ICONS.chart },
    ...(canEdit ? [{ id: "edit" as const, label: "Edit listing", href: `/list?edit=${id}`, icon: ICONS.edit }] : []),
  ];
  const tabs = items.length > 1;

  useLayoutEffect(() => {
    const el = box.current, p = pill.current;
    if (!el || !p) return;
    const tab = (v: string) => el.querySelector<HTMLElement>(`[data-view="${v}"]`);
    const put = (a: HTMLElement, instant: boolean) => {
      const b = el.getBoundingClientRect(), r = a.getBoundingClientRect();
      if (instant) p.style.transition = "none";
      p.style.width = `${r.width}px`;
      p.style.transform = `translateX(${r.left - b.left}px)`;
      p.style.opacity = "1";
      if (instant) { void p.offsetWidth; p.style.transition = ""; }
    };
    const now = tab(current);
    if (!now) return;
    let from: HTMLElement | null = null;
    try { const last = sessionStorage.getItem(LAST); if (last && last !== current) from = tab(last); sessionStorage.setItem(LAST, current); } catch { /* storage can be blocked */ }
    let raf = 0;
    if (from) { put(from, true); raf = requestAnimationFrame(() => put(now, false)); } else put(now, true);
    const onResize = () => put(now, true);
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [current, tabs]);

  // The page that loads next doesn't re-enter; the flag clears itself once it has.
  const going = () => {
    document.documentElement.dataset.listingSwitch = "1";
    setTimeout(() => { delete document.documentElement.dataset.listingSwitch; }, 5000);
  };

  // Moving between the tabs changes the address without loading a page (see ListingPages); modified clicks still open normally.
  const open = (e: React.MouseEvent, i: { id: ListingView; href: string }) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (i.id === current) return;
    going();
    window.history.pushState(null, "", i.href);
  };

  if (!tabs && !live) return null;
  return (
    <div className={`${s.listingNav} ${tabs && live ? "" : s.listingNavOne}`}>
      {tabs && (
        <nav ref={box} className={`${s.seg} ${s.segTwo}`} aria-label="This listing">
          <span ref={pill} className={`t-pill ${s.segPill}`} aria-hidden="true" />
          {items.map((i) => (
            <Link key={i.id} href={i.href} data-view={i.id} className={s.segIcon} aria-current={i.id === current ? "page" : undefined} prefetch={false} onClick={(e) => open(e, i)}>{i.icon}{i.label}</Link>
          ))}
        </nav>
      )}
      {live && <Link href={`/conferences/${slug}`} className={`button secondary ${s.viewListing}`}>{ICONS.view}View listing</Link>}
    </div>
  );
}
