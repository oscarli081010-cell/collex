"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ch from "./chamber";
import { supabase } from "./supabase";
import type { ChairSync, DelegateSync } from "./room";

export type RoomStatus = "loading" | "ready" | "denied" | "offline" | "signin";

// One call every few seconds brings a device everything it shows. It waits while the tab is hidden, and `refresh`
// asks again at once after the person does something, so their own action shows without the wait.
// `ms` may be a function, asked before each wait, so a device can slow down while nothing changes.
function usePolled<T>(fn: (() => PromiseLike<{ data: unknown; error: { code?: string } | null }>) | null, ms: number | (() => number), onData?: (d: T) => void) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<RoomStatus>("loading");
  const f = useRef(fn);
  f.current = fn;
  const cb = useRef(onData);
  cb.current = onData;
  const busy = useRef(false);
  const run = useCallback(async () => {
    if (!f.current || busy.current) return;
    busy.current = true;
    try {
      const { data: d, error } = await f.current();
      if (error) setStatus((s) => (error.code === "42501" ? "denied" : s === "ready" ? "offline" : s === "loading" ? "offline" : s));
      else if (d) { setData(d as T); setStatus("ready"); cb.current?.(d as T); }
    } catch { setStatus((s) => (s === "denied" ? s : "offline")); }
    finally { busy.current = false; }
  }, []);
  const on = !!fn;
  const wait = useRef(ms);
  wait.current = ms;
  useEffect(() => {
    if (!on) return;
    void run();
    let t = 0;
    const tick = () => {
      t = window.setTimeout(() => { if (document.visibilityState === "visible") void run(); tick(); }, typeof wait.current === "function" ? wait.current() : wait.current);
    };
    tick();
    const vis = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", vis); };
  }, [on, run, typeof ms === "number" ? ms : 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, status, refresh: run, setData };
}

/** A delegate's device: the committee as it stands, and everything of theirs in it. */
export function useDelegateRoom(cid: string | null, signedIn: boolean) {
  const db = supabase;
  // The last full answer. Its version is sent with each call, so while nothing has changed the database answers
  // without the committee itself (`same`), and the copy held here is kept.
  const held = useRef<{ cid: string; full: DelegateSync } | null>(null);
  const plain = useRef(false); // the database doesn't take `known` yet (older than the site): ask the old way
  // Every 2.5 seconds, or every 4 once nothing has changed for a minute. Any change, or anything the delegate does, makes it quick again.
  const changed = useRef(Date.now());
  const ask = async () => {
    const last = held.current?.cid === cid ? held.current.full : null;
    let res = await db!.rpc("room_sync", last && !plain.current ? { cid, known: last.version } : { cid });
    if (res.error?.code === "PGRST202" && !plain.current) { plain.current = true; res = await db!.rpc("room_sync", { cid }); }
    if (res.error || !res.data) return res;
    const d = res.data as DelegateSync & { same?: boolean };
    if (d.same) {
      if (!last) return { ...res, data: null };
      const { same: _same, ...rest } = d;
      return { ...res, data: { ...last, ...rest } };
    }
    held.current = { cid: cid!, full: d };
    changed.current = Date.now();
    return res;
  };
  const r = usePolled<DelegateSync>(cid && signedIn && db ? ask : null, () => (Date.now() - changed.current > 60_000 ? 4000 : 2500),
    (d) => { if (d.now) ch.setSkew(Date.parse(d.now) - Date.now()); });
  const st = r.data?.state;
  const c = useMemo(() => (st ? ch.normalise(st) : null), [st]);
  const again = r.refresh;
  const refresh = useCallback(() => { changed.current = Date.now(); return again(); }, [again]);
  return { ...r, refresh, c };
}

/** The chairs' side of delegates' devices. Asked for often while devices are on; otherwise only now and then, to notice them being turned on. */
export function useChairRoom(cid: string | null, fast: boolean) {
  const db = supabase;
  return usePolled<ChairSync>(cid && db ? () => db.rpc("room_chair", { cid }) : null, fast ? 2500 : 15000);
}
