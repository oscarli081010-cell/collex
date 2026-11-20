"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatRange, isPast, monogram, todayInSydney, type Conference } from "@/lib/conferences";
import { ICONS } from "../IconButton";
import SearchBox from "../SearchBox";
import { RowsSkeleton } from "../Skeleton";
import { STATUS } from "./activity/words";
import { CLOSED, TABS, VIEW_ONLY } from "./tabs";
import type { Listing } from "./useMyListings";
import s from "@/app/auth.module.css";

// A listing's photo for the lists (its cover when it has no other), or its initials when it has none.
function ListingThumb({ c }: { c: Conference }) {
  const src = c.thumb ?? c.cover, at = c.thumb ? c.thumbPos : c.coverPos;
  return (
    <span className={s.listingThumb} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- organisers' photos come straight from storage */}
      {src ? <img src={src} alt="" loading="lazy" decoding="async" style={at ? { objectPosition: at } : undefined} /> : <span className="serif">{monogram(c)}</span>}
    </span>
  );
}

// One listing you run: where it stands and its dates, then a button for each of its tabs and one to its public page.
// A button that can't be used yet is still there, greyed out, and says why on hover.
function ListingCard({ c, status, note, coOrganiser, canEdit, today }: { c: Conference; status: string; note: string; coOrganiser: boolean; canEdit: boolean; today: string }) {
  const live = status === "published";
  const open = live || status === "pending";
  const whyNot = !canEdit ? VIEW_ONLY : open ? "" : CLOSED;
  return (
    <li className={`panel ${s.listing}`}>
      <div className={s.listingTop}>
        <ListingThumb c={c} />
        <div className={s.listingMain}>
          {live ? <Link href={`/conferences/${c.slug}`} className={s.listingName}>{c.name}</Link> : <span className={s.listingName}>{c.name}</span>}
          <span className={s.listingMeta}>
            <span className={s.status} data-status={status}>{STATUS[status] ?? status}</span>
            {coOrganiser && <span className={s.tag}>Co-organiser</span>}
            {coOrganiser && !canEdit && <span className={s.tag}>View only</span>}
            {live && isPast(c, today) && <span className={s.tag}>Finished</span>}
            <span>{c.startDate ? formatRange(c) : "Dates not set"}</span>
          </span>
        </div>
      </div>
      {status === "pending" && <p className={s.listingNote}>The Collex team is reviewing it. Once approved, it gets its own page and joins the calendar.</p>}
      {(status === "rejected" || status === "unpublished") && note && <p className={s.listingNote} data-tone="danger">{note}</p>}
      <div className={s.listingButtons}>
        {TABS.map((t) => (t.editors && whyNot
          ? <span key={t.id} className="tip" data-tip={whyNot} data-tip-align="start"><button type="button" className="button secondary" disabled>{t.icon}{t.label}</button></span>
          : <Link key={t.id} href={t.href(c.id!)} className="button secondary">{t.icon}{t.label}</Link>
        ))}
        {live
          ? <Link href={`/conferences/${c.slug}`} className="button secondary">{ICONS.view}View listing</Link>
          : <span className="tip" data-tip="It gets its own page once it is live"><button type="button" className="button secondary" disabled>{ICONS.view}View listing</button></span>}
      </div>
    </li>
  );
}

// The Your conferences page: each listing you run, then a tile to add another.
export function ListingsPanel({ rows }: { rows: Listing[] | null }) {
  const today = todayInSydney();
  const [find, setFind] = useState("");
  const q = find.trim().toLowerCase();
  const shown = useMemo(
    () => (rows ?? []).filter((r) => !q || [r.c.name, r.c.host, r.c.venue, STATUS[r.status] ?? r.status].join(" ").toLowerCase().includes(q)),
    [rows, q],
  );
  if (rows === null) return <RowsSkeleton rows={2} height={148} />;
  return (
    <section className={`t-stagger ${s.listingsWide}`} aria-label="Your conferences">
      {rows.length > 1 && (
        <div className={s.listingSearch} role="search">
          <SearchBox label="Search your conferences" placeholder="Search your conferences" value={find} onChange={setFind} />
          <span className="t-swap muted" key={q} aria-live="polite">{q ? `${shown.length} of ${rows.length}` : ""}</span>
        </div>
      )}
      {rows.length > 0 && shown.length === 0 && <p className={s.listingNote}>No conferences match. Try a different word, or clear the search.</p>}
      {shown.length > 0 && (
        <ul className={s.listingList}>
          {shown.map((r) => <ListingCard key={r.c.id} c={r.c} status={r.status} note={r.note} coOrganiser={!r.mine} canEdit={r.canEdit} today={today} />)}
        </ul>
      )}
      <AddListing first={rows.length === 0} />
    </section>
  );
}

// "List a conference" as a tile of its own at the end of the list, not a stray button.
function AddListing({ first }: { first: boolean }) {
  return (
    <Link href="/list" className={s.addTile}>
      <span className={s.addIcon} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M9 3.5v11M3.5 9h11" /></svg>
      </span>
      <span className={s.addText}>
        <strong>List a conference</strong>
        <small>{first ? "Nothing listed yet. The Collex team reviews each listing before it goes live." : "The Collex team reviews it before it goes live."}</small>
      </span>
    </Link>
  );
}
