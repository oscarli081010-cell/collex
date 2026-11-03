"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatRange, isPast, todayInSydney, type Conference } from "@/lib/conferences";
import { supabase } from "@/lib/supabase";
import { useConferences } from "./ConferencesContext";
import { Thumb } from "./ConferenceRow";
import InterestChart, { type Week } from "./InterestChart";
import { RowsSkeleton } from "./Skeleton";
import { useToast } from "./useToast";
import s from "@/app/auth.module.css";

const STATUS: Record<string, string> = { pending: "In review", published: "Live", rejected: "Not approved", unpublished: "Taken down" };

type Listing = { id: string; name: string; slug: string; status: string; review_note: string; submitted_by: string | null };
type Invite = { conference_id: string; conference: string; invited_by: string };

// The account page's lists: invites to help run a listing, conferences you saved, and the listings you run.
export default function AccountSections({ userId, onListings }: { userId: string; onListings: (n: number) => void }) {
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return (
    <>
      <Invites onAccepted={reload} />
      <Saved />
      <MyListings userId={userId} version={version} onCount={onListings} />
    </>
  );
}

// Invites from organisers who want help running their listing. Accepting lets you edit it, like they can.
function Invites({ onAccepted }: { onAccepted: () => void }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState("");
  const { say, node } = useToast();
  const load = useCallback(() => {
    supabase?.rpc("my_invites").then(({ data }) => setInvites((data as Invite[] | null) ?? []));
  }, []);
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
    say(accept ? `You can now edit ${i.conference}` : "Invite declined");
    load();
    if (accept) onAccepted();
  };

  if (invites.length === 0) return node;
  return (
    <section className={`panel ${s.card} ${s.highlight}`} style={{ "--i": 0 } as React.CSSProperties} aria-labelledby="invites-h">
      <h2 id="invites-h" className={s.cardTitle}>{invites.length === 1 ? "An invite" : "Invites"} to help run a listing</h2>
      <ul className={s.listings}>
        {invites.map((i) => (
          <li key={i.conference_id}>
            <div className={s.listingMain}>
              <span className={s.listingName}>{i.conference}</span>
              <span className={s.listingMeta}>{i.invited_by} invited you as a co-organiser. You&rsquo;ll be able to edit the listing and see its interest.</span>
            </div>
            <span className={s.row}>
              <button className="button secondary" onClick={() => answer(i, false)} disabled={busy === i.conference_id}>Decline</button>
              <button className="button" onClick={() => answer(i, true)} disabled={busy === i.conference_id}>Accept</button>
            </span>
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

  return (
    <section className={`panel ${s.card}`} style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="saved-h">
      <h2 id="saved-h" className={s.cardTitle}>Saved</h2>
      {saved === null ? <RowsSkeleton rows={2} height={52} /> : list.length === 0 ? (
        <div className={s.emptyState}>
          <p className="muted">Follow a conference, or send it your interest, and it shows up here with its next key date.</p>
          <Link href="/conferences" className="button secondary">Browse conferences</Link>
        </div>
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
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Listings you sent or help run, with their review status and, once live, interest by week.
function MyListings({ userId, version, onCount }: { userId: string; version: number; onCount: (n: number) => void }) {
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [interest, setInterest] = useState<Record<string, { total: number; weeks: Week[] }>>({});
  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    (async () => {
      const { data: team } = await db.from("organisers").select("conference_id").eq("user_id", userId).not("accepted_at", "is", null);
      const ids = (team ?? []).map((t) => t.conference_id);
      const base = db.from("conferences").select("id, name, slug, status, review_note, submitted_by");
      const { data } = await (ids.length ? base.or(`submitted_by.eq.${userId},id.in.(${ids.join(",")})`) : base.eq("submitted_by", userId))
        .order("created_at", { ascending: false });
      setRows((data as Listing[] | null) ?? []);
      onCount(data?.length ?? 0);
      // How many people have expressed interest in each listing, by week. The names stay private.
      const [counts, weekly] = await Promise.all([db.rpc("interest_counts"), db.rpc("interest_weekly")]);
      const out: Record<string, { total: number; weeks: Week[] }> = {};
      for (const r of (counts.data ?? []) as { conference_id: string; interested: number }[]) out[r.conference_id] = { total: Number(r.interested), weeks: [] };
      for (const w of (weekly.data ?? []) as { conference_id: string; week: string; interested: number }[]) out[w.conference_id]?.weeks.push({ week: w.week, interested: Number(w.interested) });
      setInterest(out);
    })();
  }, [userId, version, onCount]);

  const today = todayInSydney();
  return (
    <section className={`panel ${s.card}`} style={{ "--i": 3 } as React.CSSProperties} aria-labelledby="listings-h">
      <div className={s.cardHead}>
        <h2 id="listings-h" className={s.cardTitle}>Your listings</h2>
        <Link href="/list" className="button secondary">List a conference</Link>
      </div>
      {rows === null ? <RowsSkeleton rows={2} height={44} /> : rows.length === 0 ? (
        <p className="muted">Nothing listed yet. Listings you send, or help run, show here.</p>
      ) : (
        <ul className={s.listings}>
          {rows.map((r) => (
            <li key={r.id} className={s.listingRow}>
              <div className={s.listingTop}>
                <div className={s.listingMain}>
                  {r.status === "published" ? <Link href={`/conferences/${r.slug}`} className={s.listingName}>{r.name}</Link> : <span className={s.listingName}>{r.name}</span>}
                  <span className={s.listingMeta}>
                    <span className={s.status} data-status={r.status}>{STATUS[r.status]}</span>
                    {r.submitted_by !== userId && <span className={s.tag}>Co-organiser</span>}
                    {r.status === "rejected" && r.review_note && <span>{r.review_note}</span>}
                  </span>
                </div>
                {(r.status === "published" || r.status === "pending") && <Link href={`/list?edit=${r.id}`} className="button secondary" aria-label={`Edit ${r.name}`}>Edit</Link>}
              </div>
              {r.status === "published" && interest[r.id] && (
                <InterestChart weeks={interest[r.id].weeks} total={interest[r.id].total} today={today} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
