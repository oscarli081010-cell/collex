"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { forgetListing } from "@/lib/listingData";
import { supabase } from "@/lib/supabase";
import { Placard } from "../../Drawings";
import { ICONS } from "../../IconButton";
import SearchBox from "../../SearchBox";
import { usePill } from "../../usePill";
import Section from "../Section";
import type { ListingCtx } from "../types";
import { FACES, csv, saveCsv, when, type Answer } from "./shared";
import adm from "@/app/admin.module.css";
import board from "../../board.module.css";
import s from "../../Manage.module.css";

export type Reg = {
  id: string; school: string; contact_name: string; contact_email: string; delegates: number;
  notes: string | null; status: Answer; created_at: string;
};

const STATUSES: { id: Answer; label: string }[] = [
  { id: "new", label: "New" }, { id: "accepted", label: "Accepted" }, { id: "waitlisted", label: "Waitlisted" }, { id: "declined", label: "Declined" },
];
const label = (st: Answer) => STATUSES.find((x) => x.id === st)!.label;

export const toCsv = (rows: Reg[]) => csv(
  ["School", "Contact", "Email", "Delegates", "Status", "Notes", "Registered"],
  rows.map((r) => [r.school, r.contact_name, r.contact_email, r.delegates, label(r.status), r.notes ?? "", when(r.created_at)]),
);

// Registrations from schools, answered by the people who run the conference.
export default function Registrations({ ctx }: { ctx: ListingCtx }) {
  const { c, id, live, canEdit, whyNot, say, changed, setFigures } = ctx;
  const [rows, setRows] = useState<Reg[] | null | "error">(null);
  const [filter, setFilter] = useState<Answer | "all">("all");
  const [find, setFind] = useState("");
  const tabsRef = useRef<HTMLDivElement>(null);
  const pill = usePill(tabsRef, '[aria-selected="true"]', filter);
  const [busy, setBusy] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let on = true;
    supabase.from("registrations").select("id, school, contact_name, contact_email, delegates, notes, status, created_at")
      .eq("conference_id", id).order("created_at", { ascending: false })
      .then(({ data, error }) => { if (on) setRows(error ? "error" : (data as Reg[])); });
    return () => { on = false; };
  }, [id]);

  const list = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const count = (st: Answer) => list.filter((r) => r.status === st).length;
  const loaded = Array.isArray(rows);
  const accepted = count("accepted");
  useEffect(() => {
    setFigures([{ label: "Schools", value: loaded ? String(list.length) : "–" }, { label: "Accepted", value: loaded ? String(accepted) : "–" }]);
  }, [setFigures, loaded, list.length, accepted]);

  const q = find.trim().toLowerCase();
  const shown = useMemo(
    () => list.filter((r) => (filter === "all" || r.status === filter) && (!q || [r.school, r.contact_name, r.contact_email, r.notes ?? ""].join(" ").toLowerCase().includes(q))),
    [list, filter, q],
  );

  const setStatus = useCallback(async (r: Reg, next: Answer) => {
    if (r.status === next || !supabase) return;
    setBusy(r.id);
    const before = rows;
    setRows((xs) => (Array.isArray(xs) ? xs.map((x) => (x.id === r.id ? { ...x, status: next } : x)) : xs));
    const { error } = await supabase.rpc("set_registration_status", { reg: r.id, new_status: next });
    setBusy(null);
    if (error) { setRows(before); return say("That didn’t save. Try again."); }
    say(`${r.school}: ${label(next).toLowerCase()}`);
    forgetListing(id);
  }, [rows, say, id]);

  const on = Boolean(c.collexRegistration);
  const flip = async () => {
    if (!supabase || switching) return;
    setSwitching(true);
    const { error } = await supabase.from("conferences").update({ collex_registration: !on }).eq("id", id);
    setSwitching(false);
    if (error) return say("That didn’t save. Try again.");
    say(on ? "Registration on Collex is off" : "Registration on Collex is on");
    changed();
  };

  // Only what changes how it behaves: the organiser's own link wins, and nobody can register before the listing is live.
  const warn = on && c.delegationUrl ? "Your own registration link is set, so Register goes there. Clear it in Edit listing to use this."
    : on && !live ? "Schools can register once the listing is live." : null;

  return (
    <Section id="sec-registrations" title="Registrations" toggle={{ on, busy: switching, flip, whyNot }}>
      {warn && <p className={s.note}>{warn}</p>}
      {rows === "error" ? <p className={s.note}>Couldn&rsquo;t load the registrations. Try again in a moment.</p>
        : rows === null ? <p className={s.note}>Loading…</p>
        : list.length === 0 ? (
          <div className={`${board.empty} ${s.empty}`}><Placard /><p className={board.emptyTitle}>No registrations yet</p><p className="muted">{on ? "They appear here as schools send them." : "Turn this on to take registrations on Collex."}</p></div>
        ) : (
          <>
            <div ref={tabsRef} className={`${adm.tabs} ${s.tabsFit}`} role="tablist" aria-label="Show registrations">
              <span ref={pill} className={`t-pill ${adm.tabPill}`} aria-hidden="true" />
              {([{ id: "all" as const, label: "All" }, ...STATUSES]).map((f) => (
                <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label}{f.id === "new" && count("new") > 0 ? <span className={adm.count}>{count("new")}</span> : null}
                </button>
              ))}
            </div>
            <div className={adm.searchBar} role="search">
              <SearchBox label="Search registrations" placeholder="Search by school, contact or note" value={find} onChange={setFind} />
              <span key={`${filter}${q}`} className={`t-swap muted ${adm.searchCount}`} aria-live="polite">{q || filter !== "all" ? `${shown.length} shown` : ""}</span>
            </div>
            {shown.length === 0 ? <p className={s.note}>No matches. Try a different word, or another tab.</p> : (
              <ul key={filter} className={`t-reveal ${s.regList}`}>
                {shown.map((r) => (
                  <li key={r.id} className={s.reg} data-status={r.status}>
                    <div className={s.regMain}>
                      <span className={s.regSchool}>{r.school}</span>
                      <span className={s.regMeta}>
                        {r.delegates} {r.delegates === 1 ? "delegate" : "delegates"} · {r.contact_name} · <a className="link" href={`mailto:${r.contact_email}`}>{r.contact_email}</a> · <time dateTime={r.created_at}>{when(r.created_at)}</time>
                      </span>
                      {r.notes && <span className={s.quote}>&ldquo;{r.notes}&rdquo;</span>}
                    </div>
                    <div className={s.regActions} role="group" aria-label={`Status for ${r.school}`}>
                      {FACES.map((x) => (
                        <span key={x.id} className="tip" data-tip={whyNot || (r.status === x.id ? `${x.label} (tap to undo)` : x.label)}>
                          <button type="button" className={s.face} data-status={x.id} data-on={r.status === x.id}
                            aria-pressed={r.status === x.id} disabled={busy === r.id || !canEdit} onClick={() => setStatus(r, r.status === x.id ? "new" : x.id)}
                            aria-label={`${x.label}: ${r.school}`}>{x.icon}</button>
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="button secondary block" onClick={() => saveCsv(`${c.slug}-registrations.csv`, toCsv(list))}>{ICONS.publish}Download as spreadsheet (CSV)</button>
          </>
        )}
    </Section>
  );
}
