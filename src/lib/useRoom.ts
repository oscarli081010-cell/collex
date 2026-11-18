"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as ch from "./chamber";
import { supabase } from "./supabase";
import type { ChairSync, DelegateSync } from "./room";

export type RoomStatus = "loading" | "ready" | "denied" | "offline" | "signin";

// One call every few seconds brings a device everything it shows. It waits while the tab is hidden, and `refresh`
// asks again at once after the person does something, so their own action shows without the wait.
function usePolled<T>(fn: (() => PromiseLike<{ data: unknown; error: { code?: string } | null }>) | null, ms: number, onData?: (d: T) => void) {
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
  useEffect(() => {
    if (!on) return;
    void run();
    const t = setInterval(() => { if (document.visibilityState === "visible") void run(); }, ms);
    const vis = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [on, ms, run]);
  return { data, status, refresh: run, setData };
}

/** A delegate's device: the committee as it stands, and everything of theirs in it. */
export function useDelegateRoom(cid: string | null, signedIn: boolean) {
  const db = supabase;
  const r = usePolled<DelegateSync>(cid && signedIn && db ? () => db.rpc("room_sync", { cid }) : null, 2500,
    (d) => { if (d.now) ch.setSkew(Date.parse(d.now) - Date.now()); });
  const c = r.data ? ch.normalise(r.data.state) : null;
  return { ...r, c };
}

/** The chairs' side of delegates' devices. Asked for often while devices are on; otherwise only now and then, to notice them being turned on. */
export function useChairRoom(cid: string | null, fast: boolean) {
  const db = supabase;
  return usePolled<ChairSync>(cid && db ? () => db.rpc("room_chair", { cid }) : null, fast ? 2500 : 15000);
}
