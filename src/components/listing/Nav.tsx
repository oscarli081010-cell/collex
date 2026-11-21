"use client";

import Link from "next/link";
import { useRef } from "react";
import { ICONS } from "../IconButton";
import { usePill } from "../usePill";
import { TABS, type TabDef } from "./tabs";
import type { TabId } from "./types";
import s from "./Workspace.module.css";

const back = <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3.5L2.5 8 7 12.5M2.5 8h11" /></svg>;

// Under a listing's headline band: its tabs on one sliding control, then the two ways out, back to Your conferences and
// to the listing's public page. A tab or button that can't be used is still there, greyed out, and says why on hover.
export default function ListingNav({ id, slug, current, live, whyNot, editOpen }: { id: string; slug: string; current: TabId; live: boolean; /** Empty when this person can change the listing. */ whyNot: string; /** The Edit tab opens even though the rest are shut: the listing was sent back and can be sent again. */ editOpen?: boolean }) {
  const box = useRef<HTMLElement>(null);
  const pill = usePill(box, '[aria-current="page"]', current);

  // Moving between the tabs changes the address without loading a page (see ListingPages); modified clicks still open normally.
  const open = (e: React.MouseEvent, t: TabDef) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (t.id === current) return;
    // The page that swaps in doesn't re-enter (see motion.css). The flag stays until the listing pages are left.
    document.documentElement.setAttribute("data-listing-switch", "1");
    window.history.pushState(null, "", t.href(id));
    window.scrollTo({ top: 0 });
  };

  return (
    <div className={s.nav}>
      <nav ref={box} className={s.tabs} style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }} aria-label="This listing">
        <span ref={pill} className={`t-pill ${s.tabPill}`} aria-hidden="true" />
        {TABS.map((t) => (t.editors && whyNot && !(t.id === "edit" && editOpen)
          ? <span key={t.id} className={`tip ${s.tab}`} data-tip={whyNot} data-tip-align="start" aria-disabled="true" tabIndex={0}>{t.icon}{t.label}</span>
          : <Link key={t.id} href={t.href(id)} className={s.tab} aria-current={t.id === current ? "page" : undefined} prefetch={false} onClick={(e) => open(e, t)}>{t.icon}{t.label}</Link>
        ))}
      </nav>
      <div className={s.actions}>
        <Link href="/listings" className="button secondary">{back}Your conferences</Link>
        {live
          ? <Link href={`/conferences/${slug}`} className="button secondary">{ICONS.view}View listing</Link>
          : <span className="tip" data-tip="It gets its own page once it is live"><button type="button" className="button secondary" disabled>{ICONS.view}View listing</button></span>}
      </div>
    </div>
  );
}
