"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { APP_KIND, APP_STATUS, type AppRow } from "../../ConferenceHub";
import { Gavel } from "../../Drawings";
import { ICONS } from "../../IconButton";
import SearchBox from "../../SearchBox";
import Select from "../../Select";
import Section from "../Section";
import type { ListingCtx } from "../types";
import { allocateByPreference, committeeNamed, missingCommittees, wants } from "./allocate";
import { EMAIL_DELAY, FACES, SYDNEY, csv, saveCsv, sendMail, when } from "./shared";
import bd from "../../board.module.css";
import h from "../../Hub.module.css";
import m from "../../Manage.module.css";

type Status = AppRow["status"];
const tip = (why: string, b: React.ReactNode) => (why ? <span className="tip" data-tip={why}>{b}</span> : b);
const BASE_COLUMNS = "id, conference_id, kind, role_title, name, school, year, prefs, status, committee, country, allocation_sent_at, created_at, user_id";

// Applications from individuals, answered and allocated by the people who run the conference.
export default function Applications({ ctx }: { ctx: ListingCtx }) {
  const { c, canEdit, live, say, whyNot, changed: onChanged } = ctx;
  // A view-only co-organiser doesn't get what applicants wrote in their own words, so those columns aren't asked for.
  const viewer = ctx.data.canEdit === false;
  const [rows, setRows] = useState<AppRow[] | null | "error">(null);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState<Record<string, { committee: string; country: string }>>({});
  const on = Boolean(c.collexApplications);
  const committees = c.committees.map((k) => k.name).filter(Boolean);

  const load = () => {
    if (!supabase || !c.id) return;
    const db = supabase;
    const ask = (confirmed: boolean) => db.from("applications").select(`${BASE_COLUMNS}${viewer ? "" : ", experience, note"}${confirmed ? ", confirmed_at" : ""}`)
      .eq("conference_id", c.id!).order("created_at", { ascending: false });
    const fill = (data: unknown) => setRows(((data ?? []) as Partial<AppRow>[]).map((r) => ({ experience: "", note: "", ...r }) as AppRow));
    // Confirmations are a newer column: if the database doesn't have it yet, the list still loads without them.
    const direct = () => ask(true).then(({ data, error }) => {
      if (!error) return fill(data);
      return ask(false).then((r) => (r.error ? setRows("error") : fill(r.data)));
    });
    // A view-only co-organiser reads through a function that leaves out contact details and notes. If the database
    // doesn't have it yet, the old read is used.
    if (!viewer) return void direct();
    db.rpc("team_applications", { conf: c.id! }).then(({ data, error }) => {
      if (error) return void direct();
      fill(((data ?? []) as AppRow[]).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
    });
  };
  useEffect(load, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const q = find.trim().toLowerCase();
  const shown = useMemo(() => list.filter((a) => (filter === "all" ? a.status !== "withdrawn" : a.status === filter) && (!q || [a.name, a.school, a.year, a.committee, a.country, APP_KIND(a)].join(" ").toLowerCase().includes(q))), [list, filter, q]);
  const count = (st: Status) => list.filter((a) => a.status === st).length;
  const accepted = count("accepted");
  const confirmed = list.filter((a) => a.status === "accepted" && a.confirmed_at).length;
  const gone = missingCommittees(list, committees);
  const dirty = Object.keys(draft).length;
  const unsent = list.filter((a) => a.status === "accepted" && a.committee && !a.allocation_sent_at).length;
  const value = (a: AppRow) => draft[a.id] ?? { committee: a.committee, country: a.country };

  const toggle = async () => {
    if (!supabase || busy) return;
    setBusy("toggle");
    const { error } = await supabase.from("conferences").update({ collex_applications: !on }).eq("id", c.id!);
    setBusy("");
    if (error) return say("That didn’t save. Try again.");
    say(on ? "Applications on Collex are off" : "Applications on Collex are on");
    onChanged();
  };
  const setStatus = async (a: AppRow, next: Status) => {
    if (!supabase) return;
    setBusy(a.id);
    const { error } = await supabase.rpc("set_application", { app: a.id, new_status: next });
    setBusy("");
    if (error) return say("That didn’t save. Try again.");
    say(`${a.name}: ${next === "new" ? "back to new" : next}`);
    sendMail(); load();
  };
  const edit = (a: AppRow, patch: Partial<{ committee: string; country: string }>) => {
    const next = { ...value(a), ...patch };
    setDraft((d) => { const o = { ...d }; if (next.committee === a.committee && next.country === a.country) delete o[a.id]; else o[a.id] = next; return o; });
  };
  const save = async () => {
    if (!supabase || !dirty || busy) return;
    setBusy("save");
    const { error } = await supabase.rpc("allocate_applications", { conf: c.id, allocations: Object.entries(draft).map(([id, v]) => ({ id, ...v })) });
    setBusy("");
    if (error) return say(error.message);
    setDraft({}); say("Allocations saved"); load();
  };
  const auto = () => {
    const next = allocateByPreference(list.map((a) => ({ ...a, ...value(a) })), committees);
    const n = Object.keys(next).length;
    if (!n) return say(committees.length ? "Everyone accepted already has a committee" : "Add the committees to the listing first");
    setDraft((d) => ({ ...d, ...next }));
    say(`${n} allocated from their preferences. Check them, then save.`);
  };
  const mail = async () => {
    if (!supabase || busy) return;
    setBusy("mail");
    const { data, error } = await supabase.rpc("send_allocations", { conf: c.id });
    setBusy("");
    if (error) return say(error.message);
    say(`${data} ${data === 1 ? "allocation" : "allocations"} emailed`);
    sendMail(); load();
  };
  const download = () => saveCsv(`${c.slug}-applications.csv`, csv(
    ["Name", "Applying as", "School", "Year", "Status", "Confirmed", "Committee", "Country", "Committee choices", "Country choices", "Experience", "Notes", "Applied (Sydney time)"],
    list.map((a) => [a.name, APP_KIND(a), a.school, a.year, a.status, a.confirmed_at ? "Yes" : "", a.committee, a.country, wants(a).committees.join("; "), wants(a).countries.join("; "), a.experience, a.note, when(a.created_at)]),
  ));

  return (
    <Section id="sec-applications" title="Applications" toggle={{ on, busy: busy === "toggle", flip: toggle, whyNot }}>
      {on && !live && <p className={m.note}>People can apply once the listing is live.</p>}
      {rows === "error" ? <p className={m.note}>Couldn&rsquo;t load the applications. Try again in a moment.</p>
        : rows === null ? <p className={m.note}>Loading…</p>
        : list.length === 0 ? (
        <div className={`${bd.empty} ${m.empty}`}><Gavel /><p className={bd.emptyTitle}>No applications yet</p><p className="muted">{on ? "They appear here as people apply." : "Turn this on to take applications on Collex."}</p></div>
      ) : (
        <>
          <div className={h.two}>
            <div className="field">
              <label htmlFor="apps-filter" className="sr-only">Show</label>
              <Select id="apps-filter" className="control" value={filter} onChange={(e) => setFilter(e.target.value as Status | "all")}>
                <option value="all">All applications ({list.length - count("withdrawn")})</option>
                <option value="new">New ({count("new")})</option>
                <option value="accepted">Accepted ({count("accepted")})</option>
                <option value="waitlisted">Waitlisted ({count("waitlisted")})</option>
                <option value="declined">Declined ({count("declined")})</option>
                {count("withdrawn") > 0 && <option value="withdrawn">Withdrawn ({count("withdrawn")})</option>}
              </Select>
            </div>
            <SearchBox label="Search applications" placeholder="Search by name, school or committee" value={find} onChange={setFind} />
          </div>
          {gone.people > 0 && (
            <p className={m.note} role="status">
              {gone.people} {gone.people === 1 ? "applicant chose" : "applicants chose"} {gone.names.length === 1 ? "a committee that no longer exists" : "committees that no longer exist"}: {gone.names.join(", ")}
            </p>
          )}
          {accepted > 0 && <p className={m.note}><strong>{confirmed} of {accepted} confirmed</strong></p>}
          <p className={m.note}>{EMAIL_DELAY} {SYDNEY}</p>
          {shown.length === 0 ? <p className={h.note}>No matches.</p> : (
            <ul className={h.rows}>
              {shown.map((a) => (
                <li key={a.id} className={h.app}>
                  <span className={h.main}>
                    <strong>{a.name} <span className={h.chip} data-tone={a.kind === "chair" ? "accent" : undefined}>{APP_KIND(a)}</span>{a.status === "withdrawn" && <> <span className={h.chip}>{APP_STATUS.withdrawn[0]}</span></>}{a.confirmed_at && a.status === "accepted" && <> <span className={h.chip} data-tone="ok">Confirmed</span></>}</strong>
                    <small>{[a.school, a.year, when(a.created_at)].filter(Boolean).join(" · ")}</small>
                    {(wants(a).committees.length > 0 || wants(a).countries.length > 0) && <small>Wants: {[...wants(a).committees, ...wants(a).countries].join(", ")}</small>}
                    {a.experience && <span className={h.quote}>{a.experience}</span>}
                    {a.note && <span className={h.quote}>&ldquo;{a.note}&rdquo;</span>}
                  </span>
                  {a.status === "accepted" && a.kind !== "role" && (
                    <span className={h.alloc}>
                      {committees.length > 0 ? (
                        <Select className="control" aria-label={`Committee for ${a.name}`} value={value(a).committee} disabled={!canEdit} onChange={(e) => edit(a, { committee: e.target.value })}>
                          <option value="">No committee</option>
                          {committees.map((k) => <option key={k} value={k}>{k}</option>)}
                          {value(a).committee && !committeeNamed(committees, value(a).committee) && <option value={value(a).committee}>{value(a).committee}</option>}
                        </Select>
                      ) : <input className="control" aria-label={`Committee for ${a.name}`} placeholder="Committee" maxLength={120} value={value(a).committee} disabled={!canEdit} onChange={(e) => edit(a, { committee: e.target.value })} />}
                      {a.kind === "delegate" ? <input className="control" aria-label={`Country for ${a.name}`} placeholder="Country" maxLength={80} value={value(a).country} disabled={!canEdit} onChange={(e) => edit(a, { country: e.target.value })} /> : <span />}
                    </span>
                  )}
                  {a.status === "withdrawn" ? <span className="muted">Withdrawn by the applicant</span> : <span className={h.faces} role="group" aria-label={`Answer for ${a.name}`}>
                    {FACES.map((x) => (
                      <span key={x.id} className="tip" data-tip={a.status === x.id ? `${x.label} (tap to undo)` : x.label}>
                        <button type="button" className={h.face} data-status={x.id} data-on={a.status === x.id} aria-pressed={a.status === x.id} aria-label={`${x.label}: ${a.name}`}
                          disabled={busy === a.id || !canEdit} onClick={() => void setStatus(a, a.status === x.id ? "new" : x.id)}>{x.icon}</button>
                      </span>
                    ))}
                  </span>}
                </li>
              ))}
            </ul>
          )}
          <div className={h.btnRow}>
            {tip(!canEdit ? whyNot : count("accepted") === 0 ? "Accept someone first" : "", <button type="button" className="button secondary" disabled={!canEdit || count("accepted") === 0} onClick={auto}>Allocate by Preference</button>)}
            <button type="button" className={dirty ? "button" : "button secondary"} disabled={!dirty || busy === "save"} onClick={() => void save()}>{dirty ? `Save ${dirty} ${dirty === 1 ? "Allocation" : "Allocations"}` : "Allocations Saved"}</button>
            {tip(!canEdit ? whyNot : dirty ? "Save your allocations first" : !unsent ? "Nobody is waiting for an allocation email" : "", <button type="button" className="button secondary" disabled={!canEdit || !!dirty || !unsent || busy === "mail"} onClick={() => void mail()}>{unsent ? `Email ${unsent} ${unsent === 1 ? "Allocation" : "Allocations"}` : "Allocations Emailed"}</button>)}
            {!viewer && <button type="button" className="button secondary" onClick={download}>{ICONS.publish}Download (CSV)</button>}
            {on && (live
              ? <Link href={`/conferences/${c.slug}#apply-on-collex`} className="button secondary">{ICONS.view}Preview as Applicant</Link>
              : <span className="tip" data-tip="It gets its own page once it is live"><button type="button" className="button secondary" disabled>{ICONS.view}Preview as Applicant</button></span>)}
          </div>
        </>
      )}
    </Section>
  );
}
