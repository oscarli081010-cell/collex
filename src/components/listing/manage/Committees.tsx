"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import * as ch from "@/lib/chamber";
import { STEP, ago } from "@/lib/chamberLabels";
import { supabase } from "@/lib/supabase";
import { Gavel } from "../../Drawings";
import Section from "../Section";
import type { ListingCtx } from "../types";
import bd from "../../board.module.css";
import h from "../../Hub.module.css";
import m from "../../Manage.module.css";

export type Room = { id: string; name: string; committee: string; updated_at: string; devices: boolean; state: unknown; seats: number; asks: number; chairs: string[] };

// The secretariat's wall: every committee linked to this conference, as it stands right now, and the chairs' marks across all of them.
export default function Committees({ ctx }: { ctx: ListingCtx }) {
  const { c } = ctx;
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const skew = useRef(0);
  useEffect(() => {
    if (!supabase || !c.id) return;
    let live = true;
    const run = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase!.rpc("conference_wall", { conf: c.id });
      if (!live || !data) return;
      const d = data as { now: string; rooms: Room[] };
      skew.current = Date.parse(d.now) - Date.now();
      setRooms(d.rooms);
    };
    void run();
    const t = setInterval(run, 5000);
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => { live = false; clearInterval(t); clearInterval(tick); };
  }, [c.id]);
  // The wall leaves out each committee's log (it can be long), so give it an empty one to read.
  const parsed = (rooms ?? []).map((r) => ({ r, s: r.state && typeof r.state === "object" ? ch.normalise({ ...(r.state as object), log: [] }) : null }));
  const board = parsed.flatMap(({ r, s }) => (s ? s.delegates.map((d) => ({ key: `${r.id}-${d.id}`, state: d.name, committee: r.committee || r.name, total: ch.scoreTotal(ch.scoreOf(s, d.id)), speeches: s.stats.filter((x) => x.who === d.id && ch.isSpeech(x.kind)).length })) : []))
    .filter((x) => x.total > 0).sort((a, b) => b.total - a.total || b.speeches - a.speeches).slice(0, 15);
  return (
    <Section id="sec-committees" title="Committees Live" count={rooms?.length}>
      {rooms === null ? <p className={m.note}>Loading…</p> : rooms.length === 0 ? (
        <div className={`${bd.empty} ${m.empty}`}><Gavel /><p className={bd.emptyTitle}>No committees linked yet</p><p className="muted">Chairs link theirs in <Link className="link" href="/chambers">Chambers</Link>, under Settings.</p></div>
      ) : (
        <>
          <div className={h.wall}>
            {parsed.map(({ r, s }) => {
              const fresh = Date.now() + skew.current - Date.parse(r.updated_at) < 120000;
              const sp = s?.speech;
              const who = s && sp ? ch.nameOf(s, sp.phase === "ask" ? sp.asker : sp.who) : "";
              const left = s?.timer ? ch.remaining(s.timer, now + skew.current) : null;
              return (
                <div key={r.id} className={h.room}>
                  <div className={h.roomTop}>
                    <span className={h.roomName}>{r.committee || r.name}</span>
                    <i className={h.live} data-off={!fresh} title={fresh ? "Active in the last two minutes" : `Last change ${ago(r.updated_at).toLowerCase()}`} />
                  </div>
                  {s ? (
                    <>
                      <span className={h.note}>{STEP[s.step] ?? s.step}{s.tr?.cauc ? ` · ${s.tr.cauc.kind === "mod" ? "Moderated caucus" : "Unmoderated caucus"}` : ""}</span>
                      <span className={h.roomWho}>{who || (s.poll ? "Voting" : s.tr?.cauc?.topic || s.topic || "–")}</span>
                      {left !== null && s.step !== "ended" && s.step !== "closed" && <span className={h.roomTime}>{ch.clock(left)}</span>}
                      <span className={h.roomFacts}>
                        <span>{ch.present(s)} of {s.delegates.length} present</span>
                        {s.debate.list.length > 0 && <span>{s.debate.list.length} waiting to speak</span>}
                        {r.devices && <span>{r.seats} on devices</span>}
                        {r.asks > 0 && <span>{r.asks} requests waiting</span>}
                      </span>
                    </>
                  ) : null}
                  <span className={h.note}>Chaired by {r.chairs.join(", ") || "nobody yet"}</span>
                </div>
              );
            })}
          </div>
          {board.length > 0 && (
            <table className={h.board}>
              <thead><tr><th scope="col">State</th><th scope="col">Committee</th><th scope="col">Speeches</th><th scope="col">Chairs&rsquo; marks</th></tr></thead>
              <tbody>{board.map((x) => <tr key={x.key}><th scope="row" style={{ fontWeight: 500 }}>{x.state}</th><td>{x.committee}</td><td>{x.speeches}</td><td>{x.total} / 40</td></tr>)}</tbody>
            </table>
          )}
        </>
      )}
    </Section>
  );
}
