"use client";

import Link from "next/link";
import { MyAllocation, MyApplications } from "./HubExtras";
import MyFeedback from "./MyFeedback";
import SectionNav, { type Jump } from "./SectionNav";
import { useRouter } from "next/navigation";
import { CONTACT } from "./Footer";
import h from "./Hub.module.css";
import { useMyListings } from "./listing/useMyListings";
import { useCallback, useEffect, useState } from "react";
import { formatRange, isPast, todayInSydney, type ConferenceSummary } from "@/lib/conferences";
import { supabase } from "@/lib/supabase";
import { useConferences } from "./ConferencesContext";
import { Thumb } from "./ConferenceRow";
import { ICONS } from "./IconButton";
import { RowsSkeleton } from "./Skeleton";
import { Placard } from "./Drawings";
import board from "./board.module.css";
import { useToast } from "./useToast";
import s from "@/app/auth.module.css";


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
      <MyAllocation userId={userId} />
      <MyApplications userId={userId} />
      <MyFeedback />
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
    <section id="account-invites" className={`panel ${s.card} ${s.highlight}`} style={{ "--i": 0 } as React.CSSProperties} aria-labelledby="invites-h">
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
function nextKeyDate(c: ConferenceSummary, today: string) {
  const k = c.keyDates.filter((d) => d.date && d.date >= today).sort((a, b) => a.date!.localeCompare(b.date!))[0];
  return k ? `${k.label} · ${new Date(k.date! + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : null;
}

const shiftDay = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Other conferences in the list that run on the same days, or the day before or after: you can't be at both.
function clashesOf(c: ConferenceSummary, others: ConferenceSummary[], today: string) {
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
    <section id="account-saved" className={`panel ${s.card}`} style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="saved-h">
      <div>
        <h2 id="saved-h" className={s.cardTitle}>Saved</h2>
      </div>
      {clashing.length > 0 && (
        <p className={s.clashBanner} role="status">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2.2l6.2 11H1.8z" /><path d="M8 6.5v3M8 11.6v.1" /></svg>
          <span>{clashing.length === 2 ? "Two of your saved conferences" : `${clashing.length} of your saved conferences`} overlap or run back to back. Check you can make each one.</span>
        </p>
      )}
      {saved === null ? <RowsSkeleton rows={2} height={52} /> : list.length === 0 ? (
        <div className={board.empty}><Placard /><p className={board.emptyTitle}>No saved conferences yet</p><p className="muted">Follow a conference and it shows here.</p><Link href="/conferences" className="button">Browse Conferences</Link></div>
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

// The Conferences tab's way into the Your conferences page.
function ListingsLink({ userId, version, onCount }: { userId: string; version: number; onCount: (n: number) => void }) {
  const rows = useMyListings(userId, version);
  useEffect(() => { if (rows) onCount(rows.length); }, [rows, onCount]);
  return (
    <section id="account-listings" className={`panel ${s.card}`} style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="listings-h">
      <div>
        <h2 id="listings-h" className={s.cardTitle}>Your conferences</h2>
        <p className="muted">
          {rows === null ? "\u00a0"
            : rows.length === 0 ? "You don\u2019t run a conference yet."
            : `You run ${rows.length} ${rows.length === 1 ? "conference" : "conferences"}.`}
        </p>
      </div>
      <Link href="/listings" className="button block">{ICONS.view}See my conferences</Link>
    </section>
  );
}

// The account page's side menu: the cards of the open tab (Profile or Conferences), marked as you scroll. Some cards
// only appear once their data has loaded (an invite, an allocation, feedback), so the menu lists the cards that are in
// the open tab right now: each card with an id, named by its heading.
export function AccountNav({ tab }: { tab: string }) {
  const [sections, setSections] = useState<Jump[]>([]);
  useEffect(() => {
    const panel = document.getElementById(`account-panel-${tab}`);
    if (!panel) return;
    let key = "", frame = 0;
    const read = () => {
      const list: Jump[] = [];
      for (const el of Array.from(panel.children)) {
        const h2 = el.id ? el.querySelector("h2") : null;
        if (!h2) continue;
        // The heading's own words, without a count beside them.
        const label = Array.from(h2.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("").trim();
        if (label) list.push({ id: el.id, label });
      }
      const next = list.map((x) => `${x.id}:${x.label}`).join("|");
      if (next !== key) { key = next; setSections(list); }
    };
    read();
    const mo = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(read); });
    mo.observe(panel, { childList: true, subtree: true, characterData: true });
    return () => { cancelAnimationFrame(frame); mo.disconnect(); };
  }, [tab]);
  if (!sections.length) return <div />;
  return <SectionNav label="Sections of your account" sections={sections} />;
}

// The account page's settings beyond the profile: the weekly email and deleting the account. Rendered on the Profile
// tab, after the password form.
export function AccountSettings({ userId }: { userId: string }) {
  return (
    <>
      <WeeklyEmail userId={userId} />
      <DeleteAccount userId={userId} />
    </>
  );
}

// The Monday email about the week in Sydney MUN. Off unless the person turns it on, with a switch that saves as soon as
// it is flipped. If the setting can't be read (the column isn't there yet, or the database is unreachable) the switch
// stays off and greyed, and says why.
function WeeklyEmail({ userId }: { userId: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [broken, setBroken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!supabase) { setBroken(true); return; }
    supabase.from("profiles").select("digest").eq("id", userId).maybeSingle()
      .then(({ data, error }) => { if (error) setBroken(true); else setOn(Boolean((data as { digest?: boolean } | null)?.digest)); });
  }, [userId]);
  useEffect(() => {
    if (msg !== "Saved") return;
    const t = setTimeout(() => setMsg(""), 2000);
    return () => clearTimeout(t);
  }, [msg]);
  const change = async (next: boolean) => {
    if (!supabase) return;
    setBusy(true); setOn(next); setMsg("");
    const { error } = await supabase.rpc("set_digest", { turn_on: next });
    setBusy(false);
    if (error) { setOn(!next); setMsg("That didn\u2019t save. Try again."); return; }
    setMsg("Saved");
  };
  const toggle = (
    <button type="button" id="digest-switch" role="switch" aria-checked={Boolean(on)} className={h.switch}
      disabled={broken || on === null || busy} onClick={() => void change(!on)} />
  );
  return (
    <section id="account-weekly-email" className={`panel ${s.card}`} style={{ "--i": 3 } as React.CSSProperties} aria-labelledby="digest-h">
      <h2 id="digest-h" className={s.cardTitle}>Weekly Email</h2>
      <p className="muted">This week in Sydney MUN: new conferences and closing dates. Sent on Mondays.</p>
      <div className={h.setting}>
        <label htmlFor="digest-switch">Send me the weekly email</label>
        <span className={msg === "Saved" ? h.saved : h.err} role="status">{msg}</span>
        {broken ? <span className="tip" data-tip="The weekly email can’t be changed right now">{toggle}</span> : toggle}
      </div>
    </section>
  );
}

const BUCKETS = ["covers", "photos", "guides"] as const;

// Removes every file in this account's own folder of each bucket, page by page. Throws if any of it fails, so the
// account is never deleted while its files are left behind.
async function deleteMyFiles(userId: string) {
  for (const bucket of BUCKETS) {
    for (let round = 0; round < 50; round++) {
      const { data, error } = await supabase!.storage.from(bucket).list(userId, { limit: 100 });
      if (error) throw error;
      if (!data || data.length === 0) break;
      const { data: gone, error: rmError } = await supabase!.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`));
      // Fewer removed than listed means the database refused some of them: stop before the account goes.
      if (rmError || (gone?.length ?? 0) < data.length) throw rmError ?? new Error("Some files were not removed");
      if (data.length < 100) break;
    }
  }
  // Files this person shared in committees (a private bucket, in <committee>/<uploader>/), in every committee they chair
  // or sit in. Other people's files stay: they aren't this person's to delete.
  const [chairs, seats] = await Promise.all([supabase!.rpc("my_chambers"), supabase!.rpc("my_seats")]);
  const rooms = new Set([...((chairs.data ?? []) as { id: string }[]), ...((seats.data ?? []) as { id: string }[])].map((r) => r.id));
  const files = supabase!.storage.from("chamber-files");
  for (const cid of rooms) {
    const folder = `${cid}/${userId}`;
    for (let round = 0; round < 50; round++) {
      const { data, error } = await files.list(folder, { limit: 100 });
      if (error) throw error;
      const found = (data ?? []).filter((f) => f.id); // folders have no id
      if (found.length === 0) break;
      const { data: gone, error: rmError } = await files.remove(found.map((f) => `${folder}/${f.name}`));
      if (rmError || (gone?.length ?? 0) < found.length) throw rmError ?? new Error("Some files were not removed");
      if (found.length < 100) break;
    }
  }
}

// Deleting the account: what goes and what stays, then type DELETE to arm the button.
function DeleteAccount({ userId }: { userId: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ready = typed.trim() === "DELETE";
  const remove = async () => {
    if (!supabase || !ready || busy) return;
    setBusy(true); setErr("");
    // Nothing is touched unless the database can finish the job: a database without delete_my_account (an older one)
    // would leave the account in place after its files had gone.
    const probe = await supabase.rpc("team_registrations", { conf: "00000000-0000-0000-0000-000000000000" });
    if (probe.error) {
      setBusy(false);
      return setErr("Deleting your account isn’t available right now. Nothing has been deleted. Try again later, or email " + CONTACT + ".");
    }
    try {
      await deleteMyFiles(userId);
    } catch {
      setBusy(false);
      return setErr("Some of your files couldn\u2019t be deleted, so your account hasn\u2019t been deleted. Try again, or email " + CONTACT + ".");
    }
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setBusy(false);
      return setErr("Your uploaded files are deleted, but your account couldn\u2019t be. Try again, or email " + CONTACT + ".");
    }
    await supabase.auth.signOut().catch(() => {}); // the account is already gone, so this can fail; the session ends either way
    try { for (const k of Object.keys(localStorage)) if (k.startsWith("collex:")) localStorage.removeItem(k); } catch { /* storage blocked */ }
    router.push("/");
  };
  return (
    <section id="account-delete" className={`panel ${s.card}`} style={{ "--i": 4 } as React.CSSProperties} aria-labelledby="delete-h">
      <h2 id="delete-h" className={s.cardTitle}>Delete My Account</h2>
      <div className={h.note}>
        <p>This deletes, straight away and for good:</p>
        <ul style={{ listStyle: "disc", paddingLeft: 20, marginTop: 6 }}>
          <li>Your account: your name, email, school and settings.</li>
          <li>Your applications, registrations, follows and alerts.</li>
          <li>Every photo and PDF you uploaded. That includes cover photos and background guides on conferences you run, which disappear from those pages, and files you shared in committees.</li>
          <li>Every committee you own, with everything in it, for its other chairs and delegates too. To keep one, make sure someone else has its contents before you delete your account.</li>
          <li>Your place on the teams of conferences you help run, and on committees you chair.</li>
        </ul>
        <p style={{ marginTop: 10 }}>Conferences you listed stay on the calendar, because they belong to the conference, and the record of changes is kept. To have a listing removed too, email {CONTACT}.</p>
      </div>
      <div className="field">
        <label htmlFor="delete-confirm">Type DELETE to confirm</label>
        <input id="delete-confirm" className="control" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={busy} />
      </div>
      {ready
        ? <button type="button" className="button block" style={{ background: "var(--danger)", borderColor: "var(--danger)", color: "var(--on-ink)" }} disabled={busy} onClick={() => void remove()}>{busy ? "Deleting\u2026" : "Delete My Account"}</button>
        : <span className="tip" data-tip="Type DELETE in the box first" data-tip-align="start" style={{ display: "flex" }}><button type="button" className="button block" disabled>Delete My Account</button></span>}
      {err && <p className={h.err} role="alert">{err}</p>}
    </section>
  );
}
