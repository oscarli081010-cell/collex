"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { APP_KIND, allocationText, type AppRow } from "./ConferenceHub";
import { Placard } from "./Drawings";
import { ICONS } from "./IconButton";
import PageBand from "./PageBand";
import board from "./board.module.css";
import h from "./Hub.module.css";
import s from "./CheckIn.module.css";

/** A check-in time in Sydney: "9:02 am" on the day, with the date in front on any other day. */
export const arrivedAt = (iso: string) => {
  const zone = { timeZone: "Australia/Sydney" } as const;
  const day = (d: Date) => d.toLocaleDateString("en-AU", zone);
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-AU", { ...zone, hour: "numeric", minute: "2-digit" });
  return day(d) === day(new Date()) ? time : `${d.toLocaleDateString("en-AU", { ...zone, day: "numeric", month: "short" })}, ${time}`;
};

type Found = Pick<AppRow, "id" | "kind" | "role_title" | "name" | "school" | "committee" | "country"> & {
  status: "ok" | "already" | "not_accepted"; conference_name: string; conference_slug: string; checked_in_at: string | null;
};
type View = { k: "found"; r: Found; /** Who ticked them in first, when it wasn't this scan. */ by?: string } | { k: "undone"; r: Found } | { k: "organisersOnly" }
  | { k: "viewer" } | { k: "elsewhere"; name: string | null } | { k: "unknown" } | { k: "failed" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Why the database refused a scan: this is the person's own code, they only have view access to this conference, or the
    code belongs to a conference they don't run (which they can't read, so only the database can name it). */
async function whyRefused(uid: string, token: string, name: string | null): Promise<View> {
  const { data: row } = await supabase!.from("applications").select("id, user_id").eq("checkin_token", token).maybeSingle();
  if (!row) return { k: "elsewhere", name };
  return row.user_id === uid ? { k: "organisersOnly" } : { k: "viewer" };
}

/** Who checked a person in first: "you", or the organiser's name, when it can be found out. */
async function whoFirst(uid: string, app: string): Promise<string | undefined> {
  const { data: row } = await supabase!.from("applications").select("conference_id, checked_in_by").eq("id", app).maybeSingle();
  if (!row?.checked_in_by) return undefined;
  if (row.checked_in_by === uid) return "you";
  const { data: team } = await supabase!.rpc("organisers_of", { conf: row.conference_id });
  const p = ((team ?? []) as { user_id: string; name: string; email: string }[]).find((m) => m.user_id === row.checked_in_by);
  return p ? p.name || p.email : undefined;
}

const Tick = () => (
  <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

// The page a check-in code opens. One of the conference's organisers scans a delegate's code with their phone's own
// camera app, which brings them here; the scan marks the delegate as arrived.
export default function CheckIn() {
  const { ready, session } = useAuth();
  const token = (useSearchParams().get("t") ?? "").trim().toLowerCase();
  const uid = session?.user.id;
  // The answer is kept with the code it answers, so a new scan never shows the last person's tick while it loads.
  const [got, setGot] = useState<{ key: string; view: View } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // React runs effects twice in development. One scan must check in once, or it would say "ok" and then "already".
  const asked = useRef("");
  const [tries, setTries] = useState(0); // "Try Again" after a failed request asks once more
  const key = `${uid}:${token}:${tries}`;
  const valid = UUID.test(token);

  useEffect(() => {
    if (!ready || !uid || !valid || !supabase || asked.current === key) return;
    asked.current = key;
    // No cancelling on cleanup: the second run of the effect is skipped above, so the first call's answer is the one shown.
    const db = supabase;
    (async () => {
      const { data, error } = await db.rpc("check_in", { token });
      setErr("");
      // A request that never got an answer (no signal at the door) is not a bad code, and must not look like one.
      if (error && error.code !== "42501") return setGot({ key, view: { k: "failed" } });
      if (error) return setGot({ key, view: await whyRefused(uid, token, error.details || error.hint || null) });
      if (!data) return setGot({ key, view: { k: "unknown" } });
      const r = data as Found;
      // Two people scanning the same code (or one scanning twice) get "already", with who was first and when.
      setGot({ key, view: { k: "found", r, by: r.status === "already" ? await whoFirst(uid, r.id) : undefined } });
    })();
  }, [ready, uid, valid, token, key]);

  const undo = async (r: Found) => {
    if (!supabase || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_checked_in", { app: r.id, arrived: false });
    setBusy(false);
    if (error) return setErr("That didn’t save. Try again.");
    setErr("");
    setGot({ key, view: { k: "undone", r } });
  };

  if (!ready) return null;
  if (!session) {
    return (
      <PageBand title="Check-in" aside={
        <div className="btnStack one"><Link href={`/login?next=${encodeURIComponent(`/checkin?t=${token}`)}`} className="button lg">Log In</Link></div>
      } />
    );
  }

  const view: View | null = !valid || !supabase ? { k: "unknown" } : got?.key === key ? got.view : null;
  if (!view) return <div className={s.wrap} aria-busy="true" />;

  if (view.k === "found" && view.r.status !== "not_accepted") {
    const r = view.r;
    const again = r.status === "already";
    const alloc = allocationText(r);
    return (
      <div className={s.wrap}>
        <section className={`panel ${s.card}`} aria-live="polite">
          <span className={s.tick} data-tone={again ? "warn" : undefined}><Tick /></span>
          <h1 className={s.name}>{r.name}</h1>
          <p>{[APP_KIND(r), alloc].filter(Boolean).join(" · ")}</p>
          <p className="muted">{r.conference_name}</p>
          {r.checked_in_at && <p className={s.time}>{again ? "Already checked in" : "Checked in"} at {arrivedAt(r.checked_in_at)}{again && view.by ? ` by ${view.by}` : ""}.</p>}
          <p className="muted">Times are Sydney time.</p>
          {!again && <button type="button" className="button secondary block" disabled={busy} onClick={() => void undo(r)}>{ICONS.undo}Undo</button>}
          {err && <p className={h.err} role="alert">{err}</p>}
        </section>
      </div>
    );
  }
  if (view.k === "undone") {
    return (
      <div className={s.wrap}>
        <section className={`panel ${s.card}`} aria-live="polite">
          <span className={s.tick} data-tone="off">{ICONS.undo}</span>
          <h1 className={s.name}>{view.r.name}</h1>
          <p className={s.time}>Check-in undone</p>
        </section>
      </div>
    );
  }

  if (view.k === "failed") {
    return (
      <div className={s.wrap}>
        <div className={`${board.empty} ${s.flat}`} aria-live="polite">
          <Placard />
          <h1 className={board.emptyTitle}>That didn&rsquo;t go through</h1>
          <p className="muted">Check your connection, then try again.</p>
          <button type="button" className="button" onClick={() => setTries((n) => n + 1)}>Try Again</button>
        </div>
      </div>
    );
  }

  const [title, line] = view.k === "found" ? [view.r.name, "This application hasn’t been accepted, so there’s nothing to check in."]
    : view.k === "organisersOnly" ? ["This is a check-in code.", "Show it to the secretariat at the door."]
    : view.k === "viewer" ? ["You can’t check people in.", "You’re a view-only organiser, so you can’t check people in."]
    // The code is real but its conference can't be read by this account: it runs another conference, or can only view this one.
    : view.k === "elsewhere" ? ["You can’t check this person in.", `Only organisers who can edit ${view.name ? view.name : "this conference"} can check people in. If you can only view it, ask its owner for edit access.`]
    : ["That code isn’t recognised.", null];
  return (
    <div className={s.wrap}>
      <div className={`${board.empty} ${s.flat}`} aria-live="polite">
        <Placard />
        <h1 className={board.emptyTitle}>{title}</h1>
        {line ? <p className="muted">{line}</p> : <p className="muted"><Link href="/" className="link">Go to the home page</Link></p>}
      </div>
    </div>
  );
}
