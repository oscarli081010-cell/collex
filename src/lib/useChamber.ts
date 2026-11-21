"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as ch from "./chamber";
import type { Chamber } from "./chamber";
import { supabase } from "./supabase";

export type Status = "loading" | "ready" | "offline" | "denied" | "signin";
type Remote = { state: Chamber; version: number; now: string };

export const isId = (s: string | null): s is string => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A shared committee is also kept in this browser, for two reasons. A reload with no connection still opens it, with
// whatever had not been sent yet. And the display, which is another tab of the same browser, follows the console at
// once and keeps following while the wifi is down, the way it always has for a committee kept only in this browser.
// `dirty` means the copy holds changes the database has not confirmed. `uid` is whose copy it is, so nobody else who
// logs in on the same computer is shown it. Only the console writes a copy; the display only reads.
type Role = "owner" | "admin" | "chair";
type Kept = { state: Chamber; version: number; dirty: boolean; at: number; uid: string; owner: boolean; role: Role; manage: boolean };
const KEPT = "collex:chamber:";
const KEPT_LIST = "collex:chambers:kept";
const KEEP = 5; // the most recent few; older copies are dropped so the browser's storage never fills with them
// While the console in this browser has fed the display this recently, the display takes the console's word over the
// database's: the database is always a step behind the console, and showing its copy would flick the display backwards.
const FED = 5000;
function readKept(id: string, uid: string): Kept | null {
  try {
    const k = JSON.parse(localStorage.getItem(KEPT + id) ?? "null") as Kept | null;
    if (!k || typeof k.version !== "number" || typeof k.at !== "number" || k.uid !== uid) return null;
    const state = ch.normalise(k.state);
    return state ? { ...k, state } : null;
  } catch { return null; }
}
function writeKept(id: string, k: Kept) {
  try {
    localStorage.setItem(KEPT + id, JSON.stringify(k));
    const all = JSON.parse(localStorage.getItem(KEPT_LIST) ?? "[]") as unknown;
    const ids = [id, ...(Array.isArray(all) ? all.filter((x): x is string => typeof x === "string" && x !== id) : [])];
    for (const old of ids.slice(KEEP)) localStorage.removeItem(KEPT + old);
    localStorage.setItem(KEPT_LIST, JSON.stringify(ids.slice(0, KEEP)));
  } catch { /* storage is full or blocked: the committee still works, it just can't be reopened without a connection */ }
}
const dropKept = (id: string) => { try { localStorage.removeItem(KEPT + id); } catch { /* nothing to drop */ } };
/** A committee that was deleted or left: its copy in this browser goes with it. */
export const forgetChamber = dropKept;

// The committee behind the console and the display. With no id it is the one saved in this browser. With an id it is
// a shared committee: opened from the database, followed live (and by a slow poll in case the live feed drops), and
// changed by sending the database the chair's action, which is replayed on top of anyone else's change that got in first.
export function useChamber(cloudId: string | null, o: { signedIn: boolean; authReady: boolean; readOnly?: boolean }) {
  const [c, setC] = useState<Chamber | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [owner, setOwner] = useState(false);
  // Owner, Admin (a Collex admin on the committee) or Chair. Owners and Admins manage the people and the join code.
  const [role, setRole] = useState<Role>("chair");
  const [manage, setManage] = useState(false);
  const cur = useRef<Chamber | null>(null);
  const ver = useRef(0);
  const pending = useRef<((x: Chamber) => Chamber)[]>([]);
  const pushing = useRef(false);
  const alive = useRef(true);
  const uid = useRef("");
  const meta = useRef<{ owner: boolean; role: Role; manage: boolean }>({ owner: false, role: "chair", manage: false });
  const fedAt = useRef(0); // when the console in this browser last handed the display a copy
  const pushRef = useRef<() => void>(() => {});

  const show = useCallback((next: Chamber | null) => { cur.current = next; setC(next); }, []);
  const learn = (r: { now?: string }) => { if (r.now) ch.setSkew(Date.parse(r.now) - Date.now()); };
  // The console keeps its copy of a shared committee after every change, and again once the database confirms it.
  const keep = useCallback(() => {
    if (!cloudId || o.readOnly || !cur.current || !uid.current) return;
    writeKept(cloudId, { state: cur.current, version: ver.current, dirty: pending.current.length > 0, at: Date.now(), uid: uid.current, ...meta.current });
  }, [cloudId, o.readOnly]);
  const know = (m: { owner: boolean; role: Role; manage: boolean }) => { meta.current = m; setOwner(m.owner); setRole(m.role); setManage(m.manage); };

  useEffect(() => {
    alive.current = true;
    // This run's own flag: a request started for one committee must never answer into the next one.
    let current = true;
    pending.current = [];
    ver.current = 0;
    fedAt.current = 0;
    uid.current = "";
    know({ owner: false, role: "chair", manage: false });

    if (!cloudId) {
      show(ch.load());
      setStatus("ready");
      // The display follows the console through the browser's own storage events.
      if (!o.readOnly) return () => { current = false; alive.current = false; };
      const onStore = (e: StorageEvent) => { if (e.key === ch.KEY || e.key === null) show(ch.load()); };
      window.addEventListener("storage", onStore);
      return () => { current = false; alive.current = false; window.removeEventListener("storage", onStore); };
    }

    show(null);
    if (!o.authReady) { setStatus("loading"); return () => { current = false; alive.current = false; }; }
    if (!o.signedIn || !supabase) { setStatus("signin"); return () => { current = false; alive.current = false; }; }
    setStatus("loading");
    const db = supabase;

    const adopt = (r: Remote) => {
      learn(r);
      if (pending.current.length || r.version <= ver.current) return; // our own change is on its way; it will be rebased
      if (o.readOnly && Date.now() - fedAt.current < FED) return; // the console beside this display is ahead of the database
      ver.current = r.version;
      show(ch.normalise(r.state));
      keep();
    };
    const open = async (first: boolean) => {
      // Whose browser this is: read from the session kept here, with no request, so it is known with no connection too.
      if (!uid.current) uid.current = (await db.auth.getSession()).data.session?.user.id ?? "";
      if (!current) return;
      const { data, error } = await db.rpc("open_chamber", { cid: cloudId });
      if (!current || !alive.current) return;
      if (error) {
        if (error.code === "42501") { dropKept(cloudId); setStatus("denied"); return; } // no longer theirs to open: the copy goes too
        if (!first) return;
        // No connection: carry on from the copy kept in this browser, if there is one.
        const k = readKept(cloudId, uid.current);
        if (k) {
          ver.current = k.version;
          know({ owner: k.owner, role: k.role, manage: k.manage });
          show(k.state);
          // Changes that were never confirmed go up as soon as the connection is back. They are sent as they stand: if
          // someone else has saved since, the database's copy wins, so a stale copy can never overwrite newer work.
          if (k.dirty && !o.readOnly) { pending.current = [(x) => x]; pushRef.current(); }
        }
        setStatus("offline");
        return;
      }
      const r = data as Remote & { owner: boolean; role?: Role; manage?: boolean };
      know({ owner: r.owner, role: r.role ?? (r.owner ? "owner" : "chair"), manage: r.manage ?? r.owner });
      if (first && !o.readOnly) {
        // Reloaded with changes that had not been sent, and nobody has saved since: the copy here is the newer one.
        const k = readKept(cloudId, uid.current);
        if (k?.dirty && k.version === r.version) {
          learn(r);
          ver.current = r.version;
          show(k.state);
          pending.current = [(x) => x];
          pushRef.current();
          setStatus("ready");
          return;
        }
      }
      adopt(r);
      setStatus("ready");
    };
    void open(true);

    const live = db.channel(`chamber-${cloudId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chambers", filter: `id=eq.${cloudId}` },
        (p) => {
          const r = p.new as { state: Chamber; version: number };
          if (!current) return;
          if (pending.current.length || r.version <= ver.current || (o.readOnly && Date.now() - fedAt.current < FED)) return;
          ver.current = r.version;
          show(ch.normalise(r.state));
          keep();
        })
      .subscribe();
    const poll = setInterval(() => { if (!pushing.current) void open(cur.current === null); }, 3000);
    // The display takes each copy the console in this browser keeps, the moment it is kept.
    const onStore = (e: StorageEvent) => {
      if (e.key !== KEPT + cloudId || !e.newValue || !uid.current) return;
      const k = readKept(cloudId, uid.current);
      if (!k || k.at <= fedAt.current) return;
      fedAt.current = k.at;
      ver.current = Math.max(ver.current, k.version);
      show(k.state);
    };
    if (o.readOnly) window.addEventListener("storage", onStore);
    return () => { current = false; alive.current = false; clearInterval(poll); void db.removeChannel(live); window.removeEventListener("storage", onStore); };
  }, [cloudId, o.signedIn, o.authReady, o.readOnly, show, keep]);

  // Local committees save to this browser after every change.
  useEffect(() => { if (!cloudId && status === "ready" && !o.readOnly) ch.save(c); }, [c, cloudId, status, o.readOnly]);

  const push = useCallback(async () => {
    const db = supabase;
    if (!cloudId || !db || pushing.current) return;
    pushing.current = true;
    try {
      while (pending.current.length && alive.current) {
        const n = pending.current.length;
        const { data, error } = await db.rpc("save_chamber", { cid: cloudId, new_state: cur.current, expected: ver.current });
        if (!alive.current) return;
        if (error || !data) {
          if (error?.code === "42501") { pending.current = []; dropKept(cloudId); setStatus("denied"); return; }
          setStatus("offline");
          await sleep(3000);
          continue;
        }
        const r = data as { ok: boolean; version: number; state?: Chamber; now: string };
        learn(r);
        ver.current = r.version;
        if (r.ok) { pending.current.splice(0, n); setStatus("ready"); }
        else { // someone saved first: our changes go on top of theirs
          const theirs = ch.normalise(r.state);
          if (theirs) show(pending.current.reduce((s, f) => f(s), theirs));
        }
        keep();
      }
    } finally { pushing.current = false; }
  }, [cloudId, show, keep]);
  pushRef.current = () => { void push(); };

  // Every change is a function from the committee to the next one, so it can be replayed on a newer copy.
  // Each one is kept for Back, unless it is a clock, a setting or the clock stopping itself (track = false).
  const act = useCallback((fn0: (x: Chamber) => Chamber, track = true) => {
    if (!cur.current || o.readOnly) return;
    const fn = track ? (x: Chamber) => ch.remember(x, fn0(x)) : fn0;
    if (cloudId) pending.current.push(fn);
    show(fn(cur.current));
    keep();
    if (cloudId) void push();
  }, [cloudId, o.readOnly, push, show, keep]);

  // Start or clear the committee kept in this browser.
  const setLocal = useCallback((next: Chamber | null) => { show(next); ch.save(next); }, [show]);

  return { c, status, owner, role, manage, act, setLocal };
}
