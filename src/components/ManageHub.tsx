"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as ch from "@/lib/chamber";
import { STEP, ago } from "@/lib/chamberLabels";
import type { Conference } from "@/lib/conferences";
import { supabase } from "@/lib/supabase";
import { APP_KIND, type AppRow } from "./ConferenceHub";
import { ICONS } from "./IconButton";
import SearchBox from "./SearchBox";
import Select from "./Select";
import h from "./Hub.module.css";

type Say = (t: string) => void;
type Status = AppRow["status"];
const send = () => { supabase?.functions.invoke("mailer").catch(() => {}); };
const FACES: { id: Exclude<Status, "new">; label: string; icon: React.ReactNode }[] = [
  { id: "accepted", label: "Accept", icon: ICONS.check }, { id: "waitlisted", label: "Waitlist", icon: ICONS.clock }, { id: "declined", label: "Decline", icon: ICONS.close },
];
const when = (iso: string) => new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });
const cell = (v: string | number) => { const t = String(v); return `"${(/^[=+\-@\t\r]/.test(t) ? `'${t}` : t).replaceAll('"', '""')}"`; };

/** Committees and countries for the accepted delegates who have none yet, from what each asked for: their first choice
    of committee that exists (else the emptiest one), and their first choice of country nobody in that committee has. */
export function allocateByPreference(apps: AppRow[], committees: string[]): Record<string, { committee: string; country: string }> {
  const out: Record<string, { committee: string; country: string }> = {};
  const size = new Map(committees.map((c) => [c, 0]));
  const taken = new Map(committees.map((c) => [c, new Set<string>()]));
  const accepted = apps.filter((a) => a.status === "accepted" && a.kind !== "role").sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const a of accepted) if (a.committee && a.kind === "delegate") { size.set(a.committee, (size.get(a.committee) ?? 0) + 1); if (a.country) taken.get(a.committee)?.add(a.country.toLowerCase()); }
  for (const a of accepted) {
    if (a.committee || !committees.length) continue;
    const wanted = (a.prefs.committees ?? []).find((c) => committees.includes(c));
    const committee = wanted ?? [...committees].sort((x, y) => (size.get(x) ?? 0) - (size.get(y) ?? 0))[0];
    let country = "";
    if (a.kind === "delegate") {
      size.set(committee, (size.get(committee) ?? 0) + 1);
      country = (a.prefs.countries ?? []).find((c) => !taken.get(committee)?.has(c.toLowerCase())) ?? "";
      if (country) taken.get(committee)?.add(country.toLowerCase());
    }
    out[a.id] = { committee, country };
  }
  return out;
}

/* Applications from individuals, answered and allocated by the people who run the conference. */
export function Applications({ c, canEdit, live, say, onChanged }: { c: Conference; canEdit: boolean; live: boolean; say: Say; onChanged: () => void }) {
  const [rows, setRows] = useState<AppRow[] | null | "error">(null);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState<Record<string, { committee: string; country: string }>>({});
  const on = Boolean(c.collexApplications);
  const committees = c.committees.map((k) => k.name).filter(Boolean);

  const load = () => {
    if (!supabase || !c.id) return;
    supabase.from("applications").select("id, conference_id, kind, role_title, name, school, year, experience, prefs, note, status, committee, country, allocation_sent_at, created_at, user_id")
      .eq("conference_id", c.id).order("created_at", { ascending: false })
      .then(({ data, error }) => setRows(error ? "error" : (data as AppRow[])));
  };
  useEffect(load, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = Array.isArray(rows) ? rows : [];
  const q = find.trim().toLowerCase();
  const shown = useMemo(() => list.filter((a) => (filter === "all" || a.status === filter) && (!q || [a.name, a.school, a.year, a.committee, a.country, APP_KIND(a)].join(" ").toLowerCase().includes(q))), [list, filter, q]);
  const count = (st: Status) => list.filter((a) => a.status === st).length;
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
    send(); load();
  };
  const edit = (a: AppRow, patch: Partial<{ committee: string; country: string }>) => {
    const next = { ...value(a), ...patch };
    setDraft((d) => { const o = { ...d }; if (next.committee === a.committee && next.country === a.country) delete o[a.id]; else o[a.id] = next; return o; });
  };
  const save = async () => {
    if (!supabase || !dirty) return;
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
    if (!supabase) return;
    setBusy("mail");
    const { data, error } = await supabase.rpc("send_allocations", { conf: c.id });
    setBusy("");
    if (error) return say(error.message);
    say(`${data} ${data === 1 ? "allocation" : "allocations"} emailed`);
    send(); load();
  };
  const download = () => {
    const head = ["Name", "Applying as", "School", "Year", "Status", "Committee", "Country", "Committee choices", "Country choices", "Experience", "Notes", "Applied"];
    const lines = [head.map(cell).join(",")].concat(list.map((a) => [a.name, APP_KIND(a), a.school, a.year, a.status, a.committee, a.country, (a.prefs.committees ?? []).join("; "), (a.prefs.countries ?? []).join("; "), a.experience, a.note, when(a.created_at)].map(cell).join(",")));
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const el = document.createElement("a"); el.href = url; el.download = `${c.slug}-applications.csv`; el.click(); URL.revokeObjectURL(url);
  };

  return (
    <section className={`panel ${h.card}`} aria-labelledby="apps-h">
      <div className={h.head}>
        <h2 id="apps-h" className={h.h2}>Applications{list.length > 0 && <span className={h.count}>{list.length}</span>}</h2>
        <button type="button" className={`button ${on ? "secondary" : ""}`} onClick={toggle} disabled={busy === "toggle" || !canEdit} aria-pressed={on}>{on ? "Turn off" : "Turn on"}</button>
      </div>
      <p className={h.note}>{on ? (live ? "Delegates, chairs and people for your open roles apply from your conference’s page. Each is emailed when you answer." : "People can apply once the listing is live.") : "Off. Turn this on to take applications from individual delegates and chairs on Collex, then allocate committees and countries here."}</p>
      {rows === "error" ? <p className={h.note}>Couldn&rsquo;t load the applications. Try again in a moment.</p> : list.length === 0 ? null : (
        <>
          <div className={h.two}>
            <div className="field">
              <label htmlFor="apps-filter" className="sr-only">Show</label>
              <Select id="apps-filter" className="control" value={filter} onChange={(e) => setFilter(e.target.value as Status | "all")}>
                <option value="all">All applications ({list.length})</option>
                <option value="new">New ({count("new")})</option>
                <option value="accepted">Accepted ({count("accepted")})</option>
                <option value="waitlisted">Waitlisted ({count("waitlisted")})</option>
                <option value="declined">Declined ({count("declined")})</option>
              </Select>
            </div>
            <SearchBox label="Search applications" placeholder="Search by name, school or committee" value={find} onChange={setFind} />
          </div>
          {shown.length === 0 ? <p className={h.note}>No matches.</p> : (
            <ul className={h.rows}>
              {shown.map((a) => (
                <li key={a.id} className={h.app}>
                  <span className={h.main}>
                    <strong>{a.name} <span className={h.chip} data-tone={a.kind === "chair" ? "accent" : undefined}>{APP_KIND(a)}</span></strong>
                    <small>{[a.school, a.year, when(a.created_at)].filter(Boolean).join(" · ")}</small>
                    {((a.prefs.committees ?? []).length > 0 || (a.prefs.countries ?? []).length > 0) && <small>Wants: {[...(a.prefs.committees ?? []), ...(a.prefs.countries ?? [])].join(", ")}</small>}
                    {a.experience && <span className={h.quote}>{a.experience}</span>}
                    {a.note && <span className={h.quote}>&ldquo;{a.note}&rdquo;</span>}
                  </span>
                  {a.status === "accepted" && a.kind !== "role" && (
                    <span className={h.alloc}>
                      {committees.length > 0 ? (
                        <Select className="control" aria-label={`Committee for ${a.name}`} value={value(a).committee} disabled={!canEdit} onChange={(e) => edit(a, { committee: e.target.value })}>
                          <option value="">No committee</option>
                          {committees.map((k) => <option key={k} value={k}>{k}</option>)}
                          {value(a).committee && !committees.includes(value(a).committee) && <option value={value(a).committee}>{value(a).committee}</option>}
                        </Select>
                      ) : <input className="control" aria-label={`Committee for ${a.name}`} placeholder="Committee" maxLength={120} value={value(a).committee} disabled={!canEdit} onChange={(e) => edit(a, { committee: e.target.value })} />}
                      {a.kind === "delegate" ? <input className="control" aria-label={`Country for ${a.name}`} placeholder="Country" maxLength={80} value={value(a).country} disabled={!canEdit} onChange={(e) => edit(a, { country: e.target.value })} /> : <span />}
                    </span>
                  )}
                  <span className={h.faces} role="group" aria-label={`Answer for ${a.name}`}>
                    {FACES.map((x) => (
                      <span key={x.id} className="tip" data-tip={a.status === x.id ? `${x.label} (tap to undo)` : x.label}>
                        <button type="button" className={h.face} data-status={x.id} data-on={a.status === x.id} aria-pressed={a.status === x.id} aria-label={`${x.label}: ${a.name}`}
                          disabled={busy === a.id || !canEdit} onClick={() => void setStatus(a, a.status === x.id ? "new" : x.id)}>{x.icon}</button>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className={h.btnRow}>
            <button type="button" className="button secondary" disabled={!canEdit || count("accepted") === 0} onClick={auto}>Allocate by Preference</button>
            <button type="button" className={dirty ? "button" : "button secondary"} disabled={!dirty || busy === "save"} onClick={() => void save()}>{dirty ? `Save ${dirty} ${dirty === 1 ? "Allocation" : "Allocations"}` : "Allocations Saved"}</button>
            <button type="button" className="button secondary" disabled={!canEdit || !!dirty || !unsent || busy === "mail"} onClick={() => void mail()}>{unsent ? `Email ${unsent} ${unsent === 1 ? "Allocation" : "Allocations"}` : "Allocations Emailed"}</button>
            <button type="button" className="button secondary" onClick={download}>{ICONS.publish}Download (CSV)</button>
          </div>
        </>
      )}
    </section>
  );
}

type Sent = { id: string; audience: string; subject: string; recipients: number; created_at: string };
const AUDIENCE: [string, string][] = [["accepted", "Everyone accepted"], ["applicants", "Everyone who applied"], ["delegates", "Accepted delegates"], ["chairs", "Accepted chairs"], ["schools", "Schools that registered a delegation"], ["followers", "People following the conference"]];
const TEMPLATES: { label: string; subject: string; body: string }[] = [
  { label: "Welcome and what happens next", subject: "Welcome", body: "Thank you for joining us.\n\nHere is what happens next: \n\nIf you have a question, reply to the organisers through the contact on our page." },
  { label: "Payment reminder", subject: "A reminder about your fee", body: "This is a reminder that the delegate fee is due by .\n\nHow to pay: " },
  { label: "Background guides are out", subject: "Background guides are out", body: "The background guides for every committee are now on our page. Position papers are due by ." },
  { label: "On the day", subject: "Everything you need for the day", body: "Arrive by  at .\n\nDress: Western business attire.\n\nBring: " },
];

/* Emails from the organisers to the people involved, from ready-made starts. Sent from Collex, with the conference's name. */
export function Emails({ c, canEdit, say }: { c: Conference; canEdit: boolean; say: Say }) {
  const [to, setTo] = useState("accepted");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [sent, setSent] = useState<Sent[]>([]);
  const load = () => {
    if (!supabase || !c.id) return;
    supabase.from("broadcasts").select("id, audience, subject, recipients, created_at").eq("conference_id", c.id).order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => setSent((data as Sent[] | null) ?? []));
  };
  useEffect(load, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setArmed(false); }, [to, subject, body]);
  const ok = subject.trim().length >= 3 && body.trim().length >= 10;
  const go = async () => {
    if (!supabase || !ok || busy) return;
    if (!armed) { setArmed(true); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("send_broadcast", { conf: c.id, to_audience: to, mail_subject: subject, mail_body: body });
    setBusy(false); setArmed(false);
    if (error) return say(error.message);
    say(data === 0 ? "Nobody is in that group yet, so nothing was sent" : `Sent to ${data} ${data === 1 ? "person" : "people"}`);
    setSubject(""); setBody("");
    send(); load();
  };
  return (
    <section className={`panel ${h.card}`} aria-labelledby="mail-h">
      <div className={h.head}><h2 id="mail-h" className={h.h2}>Emails</h2></div>
      <p className={h.note}>Write once and send to a whole group. Each email comes from Collex with {c.shortName}&rsquo;s name and a link to your page. Up to five a day.</p>
      <div className={h.two}>
        <div className="field">
          <label htmlFor="mail-to">Send To</label>
          <Select id="mail-to" className="control" value={to} onChange={(e) => setTo(e.target.value)} disabled={!canEdit}>{AUDIENCE.map(([k, label]) => <option key={k} value={k}>{label}</option>)}</Select>
        </div>
        <div className="field">
          <label htmlFor="mail-tpl">Start From</label>
          <Select id="mail-tpl" className="control" value="" disabled={!canEdit} onChange={(e) => { const t = TEMPLATES.find((x) => x.label === e.target.value); if (t) { setSubject(t.subject); setBody(t.body); } }}>
            <option value="">A blank email</option>
            {TEMPLATES.map((t) => <option key={t.label} value={t.label}>{t.label}</option>)}
          </Select>
        </div>
      </div>
      <div className="field"><label htmlFor="mail-sub">Subject</label><input id="mail-sub" className="control" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} disabled={!canEdit} /><small>It is sent as &ldquo;{c.name}: {subject || "your subject"}&rdquo;.</small></div>
      <div className="field"><label htmlFor="mail-body">Message</label><textarea id="mail-body" className="control" rows={7} value={body} maxLength={3000} onChange={(e) => setBody(e.target.value)} disabled={!canEdit} /></div>
      <button type="button" className="button" disabled={!canEdit || !ok || busy} onClick={() => void go()}>{busy ? "Sending…" : armed ? "Click Again to Send" : "Send Email"}</button>
      {sent.length > 0 && (
        <ul className={h.rows}>
          {sent.map((x) => (
            <li key={x.id}>
              <span className={h.main}><strong>{x.subject}</strong><small>{AUDIENCE.find(([k]) => k === x.audience)?.[1] ?? x.audience} · {x.recipients} {x.recipients === 1 ? "person" : "people"} · {when(x.created_at)}</small></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Room = { id: string; name: string; committee: string; updated_at: string; devices: boolean; state: unknown; seats: number; asks: number; chairs: string[] };

/* The secretariat's wall: every committee linked to this conference, as it stands right now, and the chairs' marks across all of them. */
export function Wall({ c }: { c: Conference }) {
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
  if (rooms === null) return null;
  const parsed = rooms.map((r) => ({ r, s: ch.normalise(r.state) }));
  const board = parsed.flatMap(({ r, s }) => (s ? s.delegates.map((d) => ({ key: `${r.id}-${d.id}`, state: d.name, committee: r.committee || r.name, total: ch.scoreTotal(ch.scoreOf(s, d.id)), speeches: s.stats.filter((x) => x.who === d.id && ch.isSpeech(x.kind)).length })) : []))
    .filter((x) => x.total > 0).sort((a, b) => b.total - a.total || b.speeches - a.speeches).slice(0, 15);
  return (
    <section className={`panel ${h.card}`} aria-labelledby="wall-h">
      <div className={h.head}><h2 id="wall-h" className={h.h2}>Committees Live{rooms.length > 0 && <span className={h.count}>{rooms.length}</span>}</h2></div>
      {rooms.length === 0 ? (
        <p className={h.note}>No committees are linked yet. A chair opens their committee in <Link className="link" href="/chambers">Chambers</Link>, shares it, and links it to this conference in its Settings. It then shows here while it runs, and its awards can be published to your page.</p>
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
                  ) : <span className={h.note}>This committee can&rsquo;t be read.</span>}
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
    </section>
  );
}
