"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRange, isPast, monogram, todayInSydney, type Conference } from "@/lib/conferences";
import { fromRow } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useConferences } from "./ConferencesContext";
import { Thumb } from "./ConferenceRow";
import { ICONS } from "./IconButton";
import SearchBox from "./SearchBox";
import { RowsSkeleton } from "./Skeleton";
import { useToast } from "./useToast";
import s from "@/app/auth.module.css";

const STATUS: Record<string, string> = { pending: "In review", published: "Live", rejected: "Not approved", unpublished: "Taken down" };

export type Listing = { c: Conference; status: string; note: string; mine: boolean; canEdit: boolean };
type Invite = { conference_id: string; conference: string; invited_by: string; role: "editor" | "viewer" };

// The account page's Conferences tab: invites to help run a listing, conferences you saved, and the listings you run.
export default function ConferencesTab({ userId, onListings, onInvites }: { userId: string; onListings: (n: number) => void; onInvites: (n: number) => void }) {
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return (
    <>
      <Invites onAccepted={reload} onCount={onInvites} />
      <Saved />
      <ListingsLink userId={userId} version={version} onCount={onListings} />
    </>
  );
}

// Invites from organisers who want help running their listing. Accepting lets you edit it, like they can.
function Invites({ onAccepted, onCount }: { onAccepted: () => void; onCount: (n: number) => void }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState("");
  const { say, node } = useToast();
  const load = useCallback(() => {
    supabase?.rpc("my_invites").then(({ data }) => {
      const list = (data as Invite[] | null) ?? [];
      setInvites(list);
      onCount(list.length); // the tab's badge, so an invite is noticed from the Profile tab too
    });
  }, [onCount]);
  useEffect(load, [load]);

  const answer = async (i: Invite, accept: boolean) => {
    if (!supabase) return;
    setBusy(i.conference_id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = accept
      ? await supabase.rpc("accept_organiser", { conf: i.conference_id })
      : await supabase.rpc("remove_organiser", { conf: i.conference_id, target: user!.id });
    setBusy("");
    if (error) return say(error.message);
    say(accept ? (i.role === "viewer" ? `You can now see ${i.conference}'s activity` : `You can now edit ${i.conference}`) : "Invite declined");
    load();
    if (accept) onAccepted();
  };

  if (invites.length === 0) return node;
  return (
    <section className={`panel ${s.card} ${s.highlight}`} style={{ "--i": 0 } as React.CSSProperties} aria-labelledby="invites-h">
      <h2 id="invites-h" className={s.cardTitle}>{invites.length === 1 ? "An invite" : "Invites"} to help run a listing</h2>
      <ul className={s.inviteList}>
        {invites.map((i) => (
          <li key={i.conference_id} className={s.invite}>
            <div className={s.listingMain}>
              <span className={s.listingName}>{i.conference}</span>
              <span className={s.listingMeta}>{i.invited_by} invited you as a co-organiser. {i.role === "viewer" ? "You\u2019ll be able to see the listing\u2019s activity." : "You\u2019ll be able to edit the listing and see its activity."}</span>
            </div>
            <div className={s.inviteActions}>
              <button className="button secondary" onClick={() => answer(i, false)} disabled={busy === i.conference_id}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
                Decline
              </button>
              <button className="button" onClick={() => answer(i, true)} disabled={busy === i.conference_id}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.8 7.4l2.8 2.8 5.6-6" /></svg>
                Accept
              </button>
            </div>
          </li>
        ))}
      </ul>
      {node}
    </section>
  );
}

// The next key date still to come, before the conference itself: "Chair applications close · 3 Feb".
function nextKeyDate(c: Conference, today: string) {
  const k = c.keyDates.filter((d) => d.date && d.date >= today).sort((a, b) => a.date!.localeCompare(b.date!))[0];
  return k ? `${k.label} · ${new Date(k.date! + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : null;
}

const shiftDay = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Other conferences in the list that run on the same days, or the day before or after: you can't be at both.
function clashesOf(c: Conference, others: Conference[], today: string) {
  if (!c.startDate) return [];
  const [as, ae] = [c.startDate, c.endDate ?? c.startDate];
  return others.flatMap((o) => {
    if (o === c || !o.startDate || isPast(o, today)) return [];
    const [bs, be] = [o.startDate, o.endDate ?? o.startDate];
    if (as <= be && bs <= ae) return [{ o, overlap: true }];
    if (as <= shiftDay(be, 1) && bs <= shiftDay(ae, 1)) return [{ o, overlap: false }];
    return [];
  });
}

// Conferences you follow or told the organisers you're interested in, soonest first.
function Saved() {
  const conferences = useConferences();
  const [saved, setSaved] = useState<Map<string, string[]> | null>(null);
  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from("follows").select("conference_id"),
      supabase.from("interests").select("conference_id"),
    ]).then(([f, i]) => {
      const m = new Map<string, string[]>();
      for (const r of f.data ?? []) m.set(r.conference_id, [...(m.get(r.conference_id) ?? []), "Following"]);
      for (const r of i.data ?? []) m.set(r.conference_id, [...(m.get(r.conference_id) ?? []), "Interested"]);
      setSaved(m);
    });
  }, []);

  const today = todayInSydney();
  const list = saved ? conferences.filter((c) => c.id && saved.has(c.id))
    .sort((a, b) => Number(isPast(a, today)) - Number(isPast(b, today)) || (a.startDate ?? "9").localeCompare(b.startDate ?? "9")) : [];

  const upcoming = list.filter((c) => !isPast(c, today));
  const clashing = upcoming.filter((c) => clashesOf(c, upcoming, today).length > 0);
  return (
    <section className={`panel ${s.card}`} style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="saved-h">
      <div>
        <h2 id="saved-h" className={s.cardTitle}>Saved</h2>
        {saved !== null && list.length === 0 && <p className="muted">Follow a conference, or send it your interest, and it shows up here with its next key date.</p>}
      </div>
      {clashing.length > 0 && (
        <p className={s.clashBanner} role="status">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2.2l6.2 11H1.8z" /><path d="M8 6.5v3M8 11.6v.1" /></svg>
          <span>{clashing.length === 2 ? "Two of your saved conferences" : `${clashing.length} of your saved conferences`} overlap or run back to back. Check you can make each one.</span>
        </p>
      )}
      {saved === null ? <RowsSkeleton rows={2} height={52} /> : list.length === 0 ? (
        <Link href="/conferences" className="button secondary">Browse conferences</Link>
      ) : (
        <ul className={s.saved}>
          {list.map((c) => {
            const past = isPast(c, today);
            const next = past ? null : nextKeyDate(c, today);
            return (
              <li key={c.id}>
                <Thumb c={c} size="sm" />
                <div className={s.listingMain}>
                  <Link href={`/conferences/${c.slug}`} className={s.listingName}>{c.name}</Link>
                  <span className={s.listingMeta}>
                    <span>{past ? "Finished" : formatRange(c)}</span>
                    {next && <span>Next: {next}</span>}
                    {saved!.get(c.id!)!.map((t) => <span key={t} className={s.tag}>{t}</span>)}
                  </span>
                  {!past && clashesOf(c, upcoming, today).map(({ o, overlap }) => (
                    <span key={o.id} className={s.clashTag}>{overlap ? "Clashes with" : "Back to back with"} {o.shortName}</span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// A listing's photo, or its initials when it has none. No page transition here: the same conference can also be in Saved.
function ListingThumb({ c }: { c: Conference }) {
  return (
    <span className={s.listingThumb} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- organisers' photos come straight from storage */}
      {c.cover ? <img src={c.cover} alt="" loading="lazy" decoding="async" /> : <span className="serif">{monogram(c)}</span>}
    </span>
  );
}

// One listing you run: where it stands, its dates, and the ways to open, edit or see its activity. Interest is on the Activity page.
export function ListingCard({ c, status, note, coOrganiser, canEdit = true, today }: { c: Conference; status: string; note: string; coOrganiser: boolean; canEdit?: boolean; today: string }) {
  const live = status === "published";
  const editable = (live || status === "pending") && canEdit;
  return (
    <li className={s.listing}>
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
      <div className={s.listingButtons}>
        <Link href={`/activity?id=${c.id}`} className="button secondary">{ICONS.chart}Activity</Link>
        {editable && <Link href={`/manage?id=${c.id}`} className="button secondary">{ICONS.manage}Manage</Link>}
        {live && <Link href={`/conferences/${c.slug}`} className="button secondary">{ICONS.view}View page</Link>}
        {editable && <Link href={`/list?edit=${c.id}`} className="button secondary">{ICONS.edit}Edit listing</Link>}
      </div>
      {status === "pending" && <p className={s.listingNote}>The Collex team is reviewing it. Once approved, it gets its own page and joins the calendar.</p>}
      {(status === "rejected" || status === "unpublished") && note && <p className={s.listingNote} data-tone="danger">{note}</p>}
    </li>
  );
}

// The listings you sent or help run, with their review status. null while they load.
export function useMyListings(userId: string, version = 0) {
  const [rows, setRows] = useState<Listing[] | null>(null);
  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    (async () => {
      const { data: team } = await db.from("organisers").select("conference_id, role").eq("user_id", userId).not("accepted_at", "is", null);
      const ids = (team ?? []).map((t) => t.conference_id);
      const roleOf = new Map((team ?? []).map((t) => [t.conference_id as string, t.role as string]));
      const base = db.from("conferences").select("*");
      const { data } = await (ids.length ? base.or(`submitted_by.eq.${userId},id.in.(${ids.join(",")})`) : base.eq("submitted_by", userId))
        .order("created_at", { ascending: false });
      const list = ((data ?? []) as (Parameters<typeof fromRow>[0] & { status: string; review_note: string; submitted_by: string | null })[])
        .map((r) => ({ c: fromRow(r), status: r.status, note: r.review_note, mine: r.submitted_by === userId, canEdit: r.submitted_by === userId || roleOf.get(r.id) === "editor" }));
      setRows(list);
    })();
  }, [userId, version]);
  return rows;
}

// The Conferences tab's way into the Your listings page.
function ListingsLink({ userId, version, onCount }: { userId: string; version: number; onCount: (n: number) => void }) {
  const rows = useMyListings(userId, version);
  useEffect(() => { if (rows) onCount(rows.length); }, [rows, onCount]);
  return (
    <section className={`panel ${s.card}`} style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="listings-h">
      <div>
        <h2 id="listings-h" className={s.cardTitle}>Your listings</h2>
        <p className="muted">
          {rows === null ? "Conferences you run or help run."
            : rows.length === 0 ? "You don\u2019t run a conference yet."
            : `You run or help run ${rows.length} ${rows.length === 1 ? "conference" : "conferences"}. Edit them, see their activity and where they stand in review.`}
        </p>
      </div>
      <Link href="/listings" className="button block">{ICONS.view}See my listings</Link>
    </section>
  );
}

// The Your listings page: each listing you run, then a tile to add another.
export function ListingsPanel({ rows }: { rows: Listing[] | null }) {
  const today = todayInSydney();
  const [find, setFind] = useState("");
  const q = find.trim().toLowerCase();
  const shown = useMemo(
    () => (rows ?? []).filter((r) => !q || [r.c.name, r.c.host, r.c.venue, STATUS[r.status] ?? r.status].join(" ").toLowerCase().includes(q)),
    [rows, q],
  );
  return (
    <section className={`panel ${s.card}`} style={{ "--i": 0 } as React.CSSProperties} aria-label="Your listings">
      {rows === null ? <RowsSkeleton rows={2} height={84} /> : (
        <>
          {rows.length > 1 && (
            <div className={s.listingSearch} role="search">
              <SearchBox label="Search your listings" placeholder="Search your conferences" value={find} onChange={setFind} />
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
        </>
      )}
    </section>
  );
}

// "List a conference" as a tile of its own at the end of the list, not a stray button.
export function AddListing({ first }: { first: boolean }) {
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
