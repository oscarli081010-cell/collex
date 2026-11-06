"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as ch from "./chamber";
import type { Chamber } from "./chamber";
import { supabase } from "./supabase";

export type Status = "loading" | "ready" | "offline" | "denied" | "signin";
type Remote = { state: Chamber; version: number; now: string };

export const isId = (s: string | null): s is string => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The committee behind the console and the display. With no id it is the one saved in this browser. With an id it is
// a shared committee: opened from the database, followed live (and by a slow poll in case the live feed drops), and
// changed by sending the database the chair's action, which is replayed on top of anyone else's change that got in first.
export function useChamber(cloudId: string | null, o: { signedIn: boolean; authReady: boolean; readOnly?: boolean }) {
  const [c, setC] = useState<Chamber | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [owner, setOwner] = useState(false);
  const cur = useRef<Chamber | null>(null);
  const ver = useRef(0);
  const pending = useRef<((x: Chamber) => Chamber)[]>([]);
  const pushing = useRef(false);
  const alive = useRef(true);

  const show = useCallback((next: Chamber | null) => { cur.current = next; setC(next); }, []);
  const learn = (r: { now?: string }) => { if (r.now) ch.setSkew(Date.parse(r.now) - Date.now()); };

  useEffect(() => {
    alive.current = true;
    pending.current = [];
    ver.current = 0;
    setOwner(false);

    if (!cloudId) {
      show(ch.load());
      setStatus("ready");
      // The display follows the console through the browser's own storage events.
      if (!o.readOnly) return () => { alive.current = false; };
      const onStore = (e: StorageEvent) => { if (e.key === ch.KEY || e.key === null) show(ch.load()); };
      window.addEventListener("storage", onStore);
      return () => { alive.current = false; window.removeEventListener("storage", onStore); };
    }

    show(null);
    if (!o.authReady) { setStatus("loading"); return () => { alive.current = false; }; }
    if (!o.signedIn || !supabase) { setStatus("signin"); return () => { alive.current = false; }; }
    setStatus("loading");
    const db = supabase;

    const adopt = (r: Remote) => {
      learn(r);
      if (pending.current.length || r.version <= ver.current) return; // our own change is on its way; it will be rebased
      ver.current = r.version;
      show(ch.normalise(r.state));
    };
    const open = async (first: boolean) => {
      const { data, error } = await db.rpc("open_chamber", { cid: cloudId });
      if (!alive.current) return;
      if (error) {
        if (first) setStatus(error.code === "42501" ? "denied" : "offline");
        else if (error.code === "42501") setStatus("denied");
        return;
      }
      const r = data as Remote & { owner: boolean };
      if (first) setOwner(r.owner);
      adopt(r);
      setStatus("ready");
    };
    void open(true);

    const live = db.channel(`chamber-${cloudId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chambers", filter: `id=eq.${cloudId}` },
        (p) => { const r = p.new as { state: Chamber; version: number }; if (!pending.current.length && r.version > ver.current) { ver.current = r.version; show(ch.normalise(r.state)); } })
      .subscribe();
    const poll = setInterval(() => { if (!pushing.current) void open(cur.current === null); }, 5000);
    return () => { alive.current = false; clearInterval(poll); void db.removeChannel(live); };
  }, [cloudId, o.signedIn, o.authReady, o.readOnly, show]);

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
          if (error?.code === "42501") { pending.current = []; setStatus("denied"); return; }
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
      }
    } finally { pushing.current = false; }
  }, [cloudId, show]);

  // Every change is a function from the committee to the next one, so it can be replayed on a newer copy.
  const act = useCallback((fn: (x: Chamber) => Chamber) => {
    if (!cur.current || o.readOnly) return;
    if (cloudId) pending.current.push(fn);
    show(fn(cur.current));
    if (cloudId) void push();
  }, [cloudId, o.readOnly, push, show]);

  // Start or clear the committee kept in this browser.
  const setLocal = useCallback((next: Chamber | null) => { show(next); ch.save(next); }, [show]);

  return { c, status, owner, act, setLocal };
}
