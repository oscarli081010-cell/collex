"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { arrivedAt } from "../../CheckIn";
import { APP_KIND, allocationText, type AppRow } from "../../ConferenceHub";
import { Placard } from "../../Drawings";
import { ICONS } from "../../IconButton";
import SearchBox from "../../SearchBox";
import Select from "../../Select";
import Section from "../Section";
import type { ListingCtx } from "../types";
import { csv, saveCsv, when } from "./shared";
import a from "../../Activity.module.css";
import bd from "../../board.module.css";
import h from "../../Hub.module.css";
import m from "../../Manage.module.css";

type Arrival = Pick<AppRow, "id" | "kind" | "role_title" | "name" | "school" | "committee" | "country"> & { checked_in_at: string | null };
type Filter = "all" | "in" | "out";

// Day-of check-in: everyone accepted, ticked off as they arrive, by a scan of their code or by hand here.
export default function CheckIn({ ctx }: { ctx: ListingCtx }) {
  const { c, id, canEdit, whyNot, say } = ctx;
  const [rows, setRows] = useState<Arrival[] | null | "error">(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState<Record<string, true>>({});
  // Bumped by every tick, and counting the ticks still saving. A read that started before a tick, or that lands while
  // one is saving, may hold the old answer and would undo the tick on screen, so it is thrown away.
  const gen = useRef(0);
  const saving = useRef(0);

  const load = useCallback(() => {
    if (!supabase) return;
    const at = gen.current;
    supabase.from("applications").select("id, kind, role_title, name, school, committee, country, checked_in_at")
      .eq("conference_id", id).eq("status", "accepted").order("name")
      .then(({ data, error }) => {
        if (at !== gen.current || saving.current > 0) return;
        // A failed refresh keeps what is on screen; only a first load that fails says so.
        if (error) setRows((r) => (Array.isArray(r) ? r : "error"));
        else setRows(data as Arrival[]);
      });
  }, [id]);

  // Read again every 10 seconds while the page is in view, so two people at the door see each other's ticks.
  useEffect(() => {
    load();
    const tick = setInterval(() => { if (document.visibilityState === "visible") load(); }, 10_000);
    const back = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", back);
    return () => { clearInterval(tick); document.removeEventListener("visibilitychange", back); };
  }, [load]);

  const list = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const arrived = list.filter((x) => x.checked_in_at).length;
  const q = find.trim().toLowerCase();
  const shown = useMemo(() => list.filter((x) => (filter === "all" || (filter === "in") === Boolean(x.checked_in_at))
    && (!q || [x.name, x.school, x.committee].join(" ").toLowerCase().includes(q))), [list, filter, q]);

  const mark = async (x: Arrival, next: boolean) => {
    if (!supabase || busy[x.id]) return;
    const before = x.checked_in_at;
    const put = (v: string | null) => setRows((r) => (Array.isArray(r) ? r.map((y) => (y.id === x.id ? { ...y, checked_in_at: v } : y)) : r));
    gen.current++; saving.current++;
    setBusy((b) => ({ ...b, [x.id]: true }));
    put(next ? new Date().toISOString() : null);
    const { error } = await supabase.rpc("set_checked_in", { app: x.id, arrived: next });
    gen.current++; saving.current--;
    setBusy((b) => { const o = { ...b }; delete o[x.id]; return o; });
    if (error) { put(before); return say("That didn’t save. Try again."); }
    load();
  };

  const download = () => saveCsv(`${c.slug}-arrivals.csv`, csv(
    ["Name", "Applying as", "School", "Committee", "Country", "Arrived"],
    list.map((x) => [x.name, APP_KIND(x), x.school, x.committee, x.country, x.checked_in_at ? when(x.checked_in_at) : ""]),
  ));

  return (
    <Section id="sec-checkin" title="Check-In">
      {rows === "error" ? <p className={m.note}>Couldn&rsquo;t load who has arrived. Try again in a moment.</p>
        : rows === null ? <p className={m.note}>Loading…</p>
        : list.length === 0 ? (
          <div className={`${bd.empty} ${m.empty}`}><Placard /><p className={bd.emptyTitle}>Nobody to check in yet</p><p className="muted">Accepted delegates and chairs appear here.</p></div>
        ) : (
          <>
            <p className="muted">Scan a delegate&rsquo;s code with your phone&rsquo;s camera, or tick them off here.</p>
            <p className={a.statValue} aria-live="polite">{arrived}<small> of {list.length} arrived</small></p>
            <div className={h.two}>
              <div className="field">
                <label htmlFor="checkin-filter" className="sr-only">Show</label>
                <Select id="checkin-filter" className="control" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
                  <option value="all">All ({list.length})</option>
                  <option value="in">Arrived ({arrived})</option>
                  <option value="out">Not yet ({list.length - arrived})</option>
                </Select>
              </div>
              <SearchBox label="Search arrivals" placeholder="Search by name, school or committee" value={find} onChange={setFind} />
            </div>
            {shown.length === 0 ? <p className={h.note}>No matches.</p> : (
              <ul className={h.rows}>
                {shown.map((x) => {
                  const on = Boolean(x.checked_in_at);
                  return (
                    <li key={x.id} className={h.app}>
                      <span className={h.main}>
                        <strong>{x.name} <span className={h.chip} data-tone={x.kind === "chair" ? "accent" : undefined}>{APP_KIND(x)}</span></strong>
                        {(x.school || allocationText(x)) && <small>{[x.school, allocationText(x)].filter(Boolean).join(" · ")}</small>}
                        {x.checked_in_at && <small>Arrived {arrivedAt(x.checked_in_at)}</small>}
                      </span>
                      <span className="tip" data-tip={whyNot || (on ? "Arrived (tap to undo)" : "Mark as arrived")}>
                        <button type="button" className={h.face} data-status="accepted" data-on={on} aria-pressed={on} aria-label={`Arrived: ${x.name}`}
                          disabled={!canEdit || Boolean(busy[x.id])} onClick={() => void mark(x, !on)}>{ICONS.check}</button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <button type="button" className="button secondary block" onClick={download}>{ICONS.publish}Download the Arrivals (CSV)</button>
          </>
        )}
    </Section>
  );
}
