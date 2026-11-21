"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as ch from "./chamber";
import type { Chamber } from "./chamber";
import { supabase } from "./supabase";

export type Status = "loading" | "ready" | "offline" | "denied" | "signin";
// `same`: the database's copy is still the version asked about, so the committee itself was left out of the answer.
type Remote = { state?: Chamber; version: number; now: string; same?: boolean };
// A change waiting to be saved. `done` is told, once the database has the change, whether it changed anything then.
// `resend` marks a copy from before a reload that is being sent as it stands: its changes can't be replayed.
type Change = { fn: (x: Chamber) => Chamber; changed: boolean; done?: (changed: boolean) => void; resend?: boolean };
const RESEND = (): Change => ({ fn: (x) => x, changed: true, resend: true });
const REPLACED = "Another chair changed the committee while you were offline. Your unsent changes were replaced.";

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
// Who last logged in on this browser, read from the login Supabase keeps here. When the login has run out and there is
// no connection to renew it, Supabase keeps it (and only removes it when someone logs out, or the server turns it down),
// so this says whose kept copy may be opened without a connection. No login kept: nobody's copy opens.
function storedUid(): string {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? "";
      if (!/^sb-.+-auth-token$/.test(key)) continue;
      const t = JSON.parse(localStorage.getItem(key) ?? "null") as { user?: { id?: string } } | null;
      const u = t?.user?.id ?? (JSON.parse(localStorage.getItem(key + "-user") ?? "null") as { user?: { id?: string } } | null)?.user?.id;
      if (typeof u === "string" && u) return u;
    }
  } catch { /* storage blocked */ }
  return "";
}
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
  // Something the chair should be told once, such as changes that were replaced or could not be saved.
  const [notice, setNotice] = useState<string | null>(null);
  // Opened from the copy in this browser while the login could not be renewed: changes wait here until it is.
  const [held, setHeld] = useState(false);
  const cur = useRef<Chamber | null>(null);
  const ver = useRef(0);
  const pending = useRef<Change[]>([]);
  const pushing = useRef(false);
  const alive = useRef(true);
  // Counts each time the committee being run changes, so a save loop started for one committee never sends for another.
  const run = useRef(0);
  const uid = useRef("");
  const meta = useRef<{ owner: boolean; role: Role; manage: boolean }>({ owner: false, role: "chair", manage: false });
  const fedAt = useRef(0); // when the console in this browser last handed the display a copy
  const pushRef = useRef<() => void>(() => {});
  const reopen = useRef<() => void>(() => {});
  const heldRef = useRef<string | null>(null); // the committee opened that way, if any
  // The next answer from the database is taken even if its version is not newer: after a change that can never be saved
  // was dropped, the copy here is ahead of the database's and must go back to it.
  const full = useRef(false);
  // Whether open_chamber takes the version already here. False only if the database has not been brought up to date yet.
  const sendKnown = useRef(true);

  const show = useCallback((next: Chamber | null) => { cur.current = next; setC(next); }, []);
  const learn = (r: { now?: string }) => { if (r.now) ch.setSkew(Date.parse(r.now) - Date.now()); };
  // The console keeps its copy of a shared committee after every change, and again once the database confirms it.
  const keep = useCallback(() => {
    if (!cloudId || o.readOnly || !cur.current || !uid.current) return;
    writeKept(cloudId, { state: cur.current, version: ver.current, dirty: pending.current.length > 0, at: Date.now(), uid: uid.current, ...meta.current });
  }, [cloudId, o.readOnly]);
  const know = (m: { owner: boolean; role: Role; manage: boolean }) => { meta.current = m; setOwner(m.owner); setRole(m.role); setManage(m.manage); };
  // Changes that will never reach the database: whoever is waiting on them hears they did not.
  const abandon = () => { const was = pending.current; pending.current = []; for (const e of was) e.done?.(false); };

  useEffect(() => {
    alive.current = true;
    run.current++;
    // This run's own flag: a request started for one committee must never answer into the next one.
    let current = true;
    // Coming back from a copy opened without a login, the committee stays on screen while the database is asked.
    const carry = heldRef.current === cloudId && cloudId ? cur.current : null;
    abandon();
    ver.current = 0;
    fedAt.current = 0;
    uid.current = "";
    full.current = false;
    heldRef.current = null;
    setHeld(false);
    know({ owner: false, role: "chair", manage: false });

    // The display takes each copy the console in this browser keeps, the moment it is kept.
    const onKept = (e: StorageEvent) => {
      if (!cloudId || e.key !== KEPT + cloudId || !e.newValue || !uid.current) return;
      const k = readKept(cloudId, uid.current);
      if (!k || k.at <= fedAt.current) return;
      fedAt.current = k.at;
      ver.current = Math.max(ver.current, k.version);
      show(k.state);
    };

    if (!cloudId) {
      show(ch.load());
      setStatus("ready");
      // The display follows the console through the browser's own storage events.
      if (!o.readOnly) return () => { current = false; alive.current = false; };
      const onStore = (e: StorageEvent) => { if (e.key === ch.KEY || e.key === null) show(ch.load()); };
      window.addEventListener("storage", onStore);
      return () => { current = false; alive.current = false; window.removeEventListener("storage", onStore); };
    }

    show(carry);
    if (!o.authReady) { if (!carry) setStatus("loading"); return () => { current = false; alive.current = false; }; }
    if (!o.signedIn || !supabase) {
      // The login ran out while there was no connection to renew it. The copy kept in this browser for the person who last
      // logged in here opens as it is, and changes made now wait in it; nothing is asked of the database until the login
      // is back, when this runs again and sends them. With no copy, or once the login is gone for good, they log in.
      const who = supabase ? storedUid() : "";
      const k = who ? readKept(cloudId, who) : null;
      if (!k) { show(null); setStatus("signin"); return () => { current = false; alive.current = false; }; }
      uid.current = who;
      ver.current = k.version;
      know({ owner: k.owner, role: k.role, manage: k.manage });
      show(k.state);
      if (k.dirty && !o.readOnly) pending.current = [RESEND()];
      heldRef.current = cloudId;
      setHeld(true);
      setStatus("offline");
      const gone = setInterval(() => {
        if (storedUid() === who) return;
        heldRef.current = null; setHeld(false); show(null); setStatus("signin"); clearInterval(gone);
      }, 5000);
      if (o.readOnly) window.addEventListener("storage", onKept);
      return () => { current = false; alive.current = false; clearInterval(gone); window.removeEventListener("storage", onKept); };
    }
    if (!carry) setStatus("loading");
    const db = supabase;

    const adopt = (r: Remote & { state: Chamber }) => {
      learn(r);
      if (pending.current.length) return; // our own change is on its way; it will be rebased
      if (r.version <= ver.current && !full.current) return;
      if (o.readOnly && Date.now() - fedAt.current < FED) return; // the console beside this display is ahead of the database
      full.current = false;
      ver.current = r.version;
      show(ch.normalise(r.state));
      keep();
    };
    const open = async (first: boolean) => {
      // Whose browser this is: read from the session kept here, with no request, so it is known with no connection too.
      if (!uid.current) uid.current = (await db.auth.getSession()).data.session?.user.id ?? "";
      if (!current) return;
      // With a copy already here, the database is told its version and leaves the committee out if nothing has changed.
      const known = !first && cur.current && !full.current && sendKnown.current;
      let { data, error } = known ? await db.rpc("open_chamber", { cid: cloudId, known: ver.current }) : await db.rpc("open_chamber", { cid: cloudId });
      if (known && error?.code === "PGRST202") { // the database doesn't take a version yet: ask the old way from now on
        sendKnown.current = false;
        ({ data, error } = await db.rpc("open_chamber", { cid: cloudId }));
      }
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
          if (k.dirty && !o.readOnly) { pending.current = [RESEND()]; pushRef.current(); }
        }
        setStatus("offline");
        return;
      }
      const r = data as Remote & { owner: boolean; role?: Role; manage?: boolean };
      know({ owner: r.owner, role: r.role ?? (r.owner ? "owner" : "chair"), manage: r.manage ?? r.owner });
      if (r.same || !r.state) { learn(r); setStatus("ready"); return; } // nothing new, and nothing to write down again
      if (first && !o.readOnly) {
        // Reloaded with changes that had not been sent, and nobody has saved since: the copy here is the newer one.
        const k = readKept(cloudId, uid.current);
        if (k?.dirty && k.version === r.version) {
          learn(r);
          ver.current = r.version;
          show(k.state);
          pending.current = [RESEND()];
          pushRef.current();
          setStatus("ready");
          return;
        }
        // Someone else saved since: theirs is the committee now, and the chair is told what happened to theirs.
        if (k?.dirty) setNotice(REPLACED);
      }
      adopt(r as Remote & { state: Chamber });
      setStatus("ready");
    };
    void open(true);
    reopen.current = () => { if (!pushing.current) void open(false); };

    const live = db.channel(`chamber-${cloudId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chambers", filter: `id=eq.${cloudId}` },
        (p) => {
          const r = p.new as { state: Chamber; version: number };
          if (!current) return;
          if (pending.current.length || (r.version <= ver.current && !full.current) || (o.readOnly && Date.now() - fedAt.current < FED)) return;
          full.current = false;
          ver.current = r.version;
          show(ch.normalise(r.state));
          keep();
        })
      .subscribe();
    const poll = setInterval(() => { if (!pushing.current) void open(cur.current === null); }, 3000);
    if (o.readOnly) window.addEventListener("storage", onKept);
    return () => { current = false; alive.current = false; reopen.current = () => {}; clearInterval(poll); void db.removeChannel(live); window.removeEventListener("storage", onKept); };
  }, [cloudId, o.signedIn, o.authReady, o.readOnly, show, keep]);

  // Local committees save to this browser after every change.
  useEffect(() => { if (!cloudId && status === "ready" && !o.readOnly) ch.save(c); }, [c, cloudId, status, o.readOnly]);

  const push = useCallback(async () => {
    const db = supabase;
    if (!cloudId || !db || pushing.current || heldRef.current) return;
    pushing.current = true;
    const mine = run.current;
    try {
      while (pending.current.length && alive.current && run.current === mine && !heldRef.current) {
        const sent = pending.current.slice();
        // Small enough to save: a committee saved before the limits, or grown by changes that keep no step, is trimmed here.
        if (cur.current) { const fitted = ch.fit(cur.current); if (fitted !== cur.current) show(fitted); }
        const { data, error, status: http } = await db.rpc("save_chamber", { cid: cloudId, new_state: cur.current, expected: ver.current });
        if (!alive.current || run.current !== mine) return;
        if (error || !data) {
          if (error?.code === "42501") { abandon(); dropKept(cloudId); setStatus("denied"); return; }
          if (error && ch.savePermanent(error.code, http)) {
            // This copy can never be saved, however often it is sent. It is let go, and the committee goes back to the
            // database's copy on the next answer, so the chair is not left offline with changes that can never arrive.
            abandon();
            full.current = true;
            setNotice(error.code === "23514"
              ? "That change made the committee too big to save, so it was undone."
              : `That change couldn't be saved, so it was undone. ${error.message}`.trim());
            setStatus("ready");
            // The copy kept in this browser still holds the undone change: it goes, and the database's copy is kept again when it arrives.
            dropKept(cloudId);
            pushing.current = false;
            reopen.current();
            return;
          }
          setStatus("offline");
          await sleep(3000);
          continue;
        }
        const r = data as { ok: boolean; version: number; state?: Chamber; now: string };
        learn(r);
        ver.current = r.version;
        if (r.ok) {
          pending.current.splice(0, sent.length);
          for (const e of sent) e.done?.(e.changed);
          setStatus("ready");
        } else { // someone saved first: our changes go on top of theirs
          const theirs = ch.normalise(r.state);
          // A copy sent as it stood before a reload can't be replayed: what it held is replaced, and the chair is told.
          if (pending.current.some((e) => e.resend)) { pending.current = pending.current.filter((e) => !e.resend); setNotice(REPLACED); }
          if (theirs) {
            let x = theirs;
            for (const e of pending.current) { const y = e.fn(x); e.changed = y !== x; x = y; }
            show(x);
          }
        }
        keep();
      }
    } finally {
      pushing.current = false;
      // This loop was for a committee that has since been left: anything waiting for the one open now is sent by a new loop.
      if (run.current !== mine && pending.current.length) setTimeout(() => pushRef.current(), 0);
    }
  }, [cloudId, show, keep]);
  pushRef.current = () => { void push(); };

  // Every change is a function from the committee to the next one, so it can be replayed on a newer copy.
  // Each one is kept for Back, unless it is a clock, a setting or the clock stopping itself (track = false).
  // The answer says, once the database has the change (at once for a committee kept only here), whether it changed
  // anything: replayed on a newer copy it may not. A change that never arrives answers false.
  const act = useCallback((fn0: (x: Chamber) => Chamber, track = true): Promise<boolean> => {
    if (!cur.current || o.readOnly) return Promise.resolve(false);
    // Each step kept for Back says which chair made it, so one chair's Back never takes back another's step.
    const by = uid.current || undefined;
    const fn = track ? (x: Chamber) => ch.remember(x, fn0(x), by) : fn0;
    const next = fn(cur.current);
    const changed = next !== cur.current;
    let answer: Promise<boolean> = Promise.resolve(changed);
    if (cloudId) answer = new Promise<boolean>((done) => { pending.current.push({ fn, changed, done }); });
    show(next);
    keep();
    if (cloudId) void push();
    return answer;
  }, [cloudId, o.readOnly, push, show, keep]);

  // Start or clear the committee kept in this browser.
  const setLocal = useCallback((next: Chamber | null) => { show(next); ch.save(next); }, [show]);
  const clearNotice = useCallback(() => setNotice(null), []);

  // Who this chair is, for Back.
  const me = useCallback(() => uid.current || undefined, []);

  return { c, status, owner, role, manage, act, setLocal, notice, clearNotice, held, me };
}
