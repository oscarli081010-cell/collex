"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Conference } from "@/lib/conferences";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { conferencesById, guideFor, nextDate } from "./allocation";
import { APP_KIND, APP_STATUS, allocationText, type AppRow } from "./ConferenceHub";
import { Gavel, Placard } from "./Drawings";
import PageBand from "./PageBand";
import QrCode from "./QrCode";
import Select from "./Select";
import board from "./board.module.css";
import ci from "./CheckIn.module.css";
import au from "@/app/auth.module.css";
import h from "./Hub.module.css";

type Say = (t: string) => void;
const send = () => { supabase?.functions.invoke("mailer").catch(() => {}); };
const day = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "");

type Claim = { id: string; conference: string; slug: string; name: string; email: string; role: string; proof: string; status: string; created_at: string };

/* Admin, Review tab: people asking to take over a listing Collex added. */
export function AdminClaims({ say }: { say: Say }) {
  const [rows, setRows] = useState<Claim[]>([]);
  const [busy, setBusy] = useState("");
  const load = () => { supabase?.rpc("admin_claims").then(({ data }) => setRows(((data as Claim[] | null) ?? []).filter((x) => x.status === "pending"))); };
  useEffect(load, []);
  const decide = async (k: Claim, approve: boolean) => {
    if (!supabase) return;
    setBusy(k.id);
    const { error } = await supabase.rpc("decide_claim", { claim: k.id, approve });
    setBusy("");
    if (error) return say(error.message);
    say(approve ? `${k.conference} now belongs to ${k.name || k.email}` : "Claim declined");
    send(); load();
  };
  if (rows.length === 0) return null;
  return (
    <section className={`panel ${h.card}`} aria-labelledby="claims-h" style={{ marginBottom: 16 }}>
      <div className={h.head}><h2 id="claims-h" className={h.h2}>Claims<span className={h.count}>{rows.length}</span></h2></div>
      <ul className={h.rows}>
        {rows.map((k) => (
          <li key={k.id} className={h.app}>
            <span className={h.main}>
              <strong><Link className="link" href={`/conferences/${k.slug}`}>{k.conference}</Link></strong>
              <small>{k.name || "No name"} · <a className="link" href={`mailto:${k.email}`}>{k.email}</a> · {k.role}</small>
              <span className={h.quote}>&ldquo;{k.proof}&rdquo;</span>
            </span>
            <span className={h.btns}>
              <button type="button" className="button sm" disabled={busy === k.id} onClick={() => void decide(k, true)}>Approve</button>
              <button type="button" className="button secondary sm" disabled={busy === k.id} onClick={() => void decide(k, false)}>Decline</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// The database also has "withdrawn", which the shared status list may not know yet: it reads as Withdrawn, never a crash.
type Status = AppRow["status"] | "withdrawn";
type Mine = Omit<AppRow, "status"> & { status: Status; conferences: { name: string; slug: string } | null; checkin_token: string; checked_in_at: string | null };
const statusOf = (s: Status): [string, string | undefined] => (APP_STATUS as Record<string, [string, string | undefined]>)[s] ?? (s === "withdrawn" ? ["Withdrawn", undefined] : [s, undefined]);
const MINE_COLUMNS = "id, conference_id, kind, role_title, status, committee, country, created_at, checkin_token, checked_in_at, conferences(name, slug)";

/* Account: the conferences you applied to as one person, and whether your record of them is public. */
export function MyApplications({ userId }: { userId: string }) {
  const { refresh } = useAuth();
  const [rows, setRows] = useState<Mine[] | null>(null);
  const [pub, setPub] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.from("applications").select(MINE_COLUMNS).eq("user_id", userId).order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as unknown as Mine[] | null) ?? []));
    supabase.from("profiles").select("public_record").eq("id", userId).maybeSingle().then(({ data }) => setPub(Boolean(data?.public_record)));
  }, [userId]);
  const toggle = async (on: boolean) => {
    if (!supabase) return;
    setPub(on);
    const { error } = await supabase.from("profiles").update({ public_record: on }).eq("id", userId);
    if (error) setPub(!on); else void refresh();
  };
  const url = typeof location === "undefined" ? "" : `${location.origin}/delegates/${userId}`;
  return (
    <section id="account-applications" className={`panel ${au.card}`} aria-labelledby="myapps-h">
      <div>
        <h2 id="myapps-h" className={au.cardTitle}>Your applications</h2>
      </div>
      {rows !== null && rows.length === 0 && (
        <div className={`${board.empty} ${h.flush}`}><Gavel /><p className={board.emptyTitle}>No applications yet</p><p className="muted">Apply to a conference as a delegate or chair and it shows here.</p></div>
      )}
      {rows && rows.length > 0 && (
        <ul className={h.rows}>
          {rows.map((a) => {
            const accepted = a.status === "accepted";
            const open = accepted && code === a.id;
            return (
              <li key={a.id} className={accepted ? h.app : undefined}>
                <span className={h.main}>
                  <strong>{a.conferences ? <Link className="link" href={`/conferences/${a.conferences.slug}`}>{a.conferences.name}</Link> : "A conference"}</strong>
                  <small>{APP_KIND(a)}{accepted && allocationText(a) ? ` · ${allocationText(a)}` : ""}</small>
                </span>
                <span className={h.btns}>
                  {accepted && a.checked_in_at && <span className={h.chip} data-tone="ok">Checked in</span>}
                  <span className={h.chip} data-tone={statusOf(a.status)[1]}>{statusOf(a.status)[0]}</span>
                  {accepted && (
                    <button type="button" className="button secondary sm" aria-expanded={open} aria-controls={`code-${a.id}`} onClick={() => setCode(open ? null : a.id)}>Check-in Code</button>
                  )}
                </span>
                {open && (
                  <div id={`code-${a.id}`} className={ci.code}>
                    <QrCode value={`${location.origin}/checkin?t=${a.checkin_token}`} size={200} label={`Check-in code for ${a.conferences?.name ?? "this conference"}`} />
                    <strong>{a.conferences?.name ?? "A conference"}</strong>
                    <small className="muted">Show this at the door.</small>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {/* The same switch row as the weekly email */}
      <div className={h.setting}>
        <label htmlFor="record-switch">Make my MUN record public</label>
        <button type="button" id="record-switch" role="switch" aria-checked={Boolean(pub)} className={h.switch}
          disabled={pub === null} onClick={() => void toggle(!pub)} />
      </div>
      <div className={h.btnRow}>
        <Link href={`/delegates/${userId}`} className="button secondary">See My Record</Link>
        {pub ? <button type="button" className="button secondary block" onClick={() => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>{copied ? "Link Copied" : "Copy the Link"}</button>
          : <span className="tip" data-tip="Make your record public first" data-tip-align="start" style={{ display: "flex" }}><button type="button" className="button secondary block" disabled>Copy the Link</button></span>}
      </div>
    </section>
  );
}

/* Account: where each accepted application puts you, and what to do next. A withdrawn place says so and nothing more.
   confirmed_at is read on its own, so the list still loads if that column or confirm_place isn't there yet. */
export function MyAllocation({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Mine[] | null>(null);
  const [confs, setConfs] = useState<Map<string, Conference>>(new Map());
  const [confirmed, setConfirmed] = useState<Map<string, string | null> | null>(null); // null: can't confirm right now
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.from("applications").select(MINE_COLUMNS).eq("user_id", userId).in("status", ["accepted", "withdrawn"]).order("created_at", { ascending: false })
      .then(({ data }) => {
        const list = ((data as unknown as Mine[] | null) ?? []).filter((a) => a.status === "accepted" || (a.status === "withdrawn" && a.committee));
        setRows(list);
        void conferencesById([...new Set(list.map((a) => a.conference_id))]).then(setConfs);
      });
    supabase.from("applications").select("id, confirmed_at").eq("user_id", userId)
      .then(({ data, error }) => setConfirmed(error ? null : new Map(((data as { id: string; confirmed_at: string | null }[] | null) ?? []).map((r) => [r.id, r.confirmed_at]))));
  }, [userId]);

  const confirm = async (id: string) => {
    if (!supabase) return;
    setBusy(id); setErr("");
    const { error } = await supabase.rpc("confirm_place", { app: id });
    setBusy("");
    if (error) return setErr("That didn’t go through. Try again, or tell the organisers by email.");
    setConfirmed((m) => new Map(m ?? []).set(id, new Date().toISOString()));
  };

  if (!rows || rows.length === 0) return null;
  return (
    <section id="account-allocation" className={`panel ${au.card}`} aria-labelledby="alloc-h">
      <h2 id="alloc-h" className={au.cardTitle}>My allocation</h2>
      <ul className={h.rows}>
        {rows.map((a) => {
          const c = confs.get(a.conference_id);
          const name = a.conferences?.name ?? c?.name ?? "A conference";
          const slug = a.conferences?.slug ?? c?.slug;
          if (a.status === "withdrawn") {
            return (
              <li key={a.id}>
                <span className={h.main}><strong>{slug ? <Link className="link" href={`/conferences/${slug}`}>{name}</Link> : name}</strong></span>
                <span className={h.btns}><span className={h.chip}>Withdrawn</span></span>
              </li>
            );
          }
          const guide = guideFor(c, a.committee);
          const next = nextDate(c);
          const done = confirmed?.get(a.id);
          const open = code === a.id;
          const facts = [a.kind === "delegate" ? a.country : APP_KIND(a), a.committee && (a.kind === "chair" ? `Chairing ${a.committee}` : a.committee)].filter(Boolean).join(" · ");
          return (
            <li key={a.id} className={h.app}>
              <span className={h.main}>
                <strong>{slug ? <Link className="link" href={`/conferences/${slug}`}>{name}</Link> : name}</strong>
                <small>{facts || "Allocation to come"}</small>
                {next && <small>Next: {next}</small>}
                {a.committee && <small>{guide ? <a className="link" href={guide} target="_blank" rel="noreferrer">Background guide (opens in a new tab)</a> : "Background guide not released yet"}</small>}
              </span>
              <span className={h.btns}>
                {a.checked_in_at && <span className={h.chip} data-tone="ok">Checked in</span>}
                {done && <span className={h.chip} data-tone="ok">Place Confirmed</span>}
              </span>
              <div className={h.btnRow} style={{ flexBasis: "100%" }}>
                {confirmed === null
                  ? <span className="tip" data-tip="Confirming isn’t available right now" data-tip-align="start" style={{ display: "flex" }}><button type="button" className="button block" disabled>Confirm My Place</button></span>
                  : done
                    ? <span className="tip" data-tip="The organisers know you’re coming" data-tip-align="start" style={{ display: "flex" }}><button type="button" className="button block" disabled>Place Confirmed</button></span>
                    : <span className="tip" data-tip="Tells the organisers you’re coming" data-tip-align="start" style={{ display: "flex" }}><button type="button" className="button block" disabled={busy === a.id} onClick={() => void confirm(a.id)}>{busy === a.id ? "Confirming…" : "Confirm My Place"}</button></span>}
                {a.kind === "delegate" && <Link href={`/prepare?app=${a.id}`} className="button secondary">Prepare</Link>}
                <button type="button" className="button secondary" aria-expanded={open} aria-controls={`alloc-code-${a.id}`} onClick={() => setCode(open ? null : a.id)}>Check-in Code</button>
              </div>
              {open && (
                <div id={`alloc-code-${a.id}`} className={ci.code}>
                  <QrCode value={`${location.origin}/checkin?t=${a.checkin_token}`} size={200} label={`Check-in code for ${name}`} />
                  <strong>{name}</strong>
                  <small className="muted">Show this at the door.</small>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {err && <p className={h.err} role="alert">{err}</p>}
    </section>
  );
}

type Rec = {
  name: string; school: string; public: boolean;
  conferences: { name: string; slug: string; start: string | null; kind: string; role: string; committee: string; country: string }[];
};

/* A delegate's record: the conferences that accepted them. Only there when its owner made it public. */
export function DelegateRecord({ id }: { id: string }) {
  const { ready, session } = useAuth();
  const [rec, setRec] = useState<Rec | null | "none">(null);
  useEffect(() => {
    if (!supabase || !ready) return;
    supabase.rpc("delegate_record", { uid: id }).then(({ data }) => setRec((data as Rec | null) ?? "none"));
  }, [id, ready, session]);
  if (rec === null) return <main id="top" className="container" />;
  if (rec === "none") {
    return (
      <main id="top" className="container">
        <PageBand title="No record" accent="here" />
        <div className={board.empty}><Placard /><p className={board.emptyTitle}>This record is private or doesn&rsquo;t exist.</p><p className="muted">If it is yours, check that you have shared it, or that the link is right.</p><Link href="/conferences" className="button secondary">See the Conferences</Link></div>
      </main>
    );
  }
  return (
    <main id="top" className="container" style={{ paddingBottom: 72 }}>
      <PageBand title={rec.name || "A delegate"} lead={rec.school || undefined}
        figures={[{ label: "Conferences", value: String(rec.conferences.length) }]} />
      {!rec.public && <p className={h.note} style={{ margin: "16px 0" }}>Only you can see this. Make it public from your account to share it.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
        <section className={`panel ${h.card}`} aria-labelledby="rec-c">
          <div className={h.head}><h2 id="rec-c" className={h.h2}>Conferences</h2></div>
          {rec.conferences.length === 0 ? <div className={board.empty}><Placard /><p className={board.emptyTitle}>No conferences yet</p><p className="muted">Conferences you run or take part in show here.</p></div> : (
            <ul className={h.rows}>
              {rec.conferences.map((c, i) => (
                <li key={i}>
                  <span className={h.main}>
                    <strong><Link className="link" href={`/conferences/${c.slug}`}>{c.name}</Link></strong>
                    <small>{[day(c.start), c.kind === "chair" ? (c.committee ? `Chair of ${c.committee}` : "Chair") : c.kind === "role" ? c.role : c.country && c.committee ? `${c.country} in ${c.committee}` : c.committee || "Delegate"].filter(Boolean).join(" · ")}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

type Conf = { id: string; name: string; slug: string; committees: string[] };
type Link_ = { conference_id: string | null; committee: string; name: string | null; slug: string | null };

/* Committees, Share: link the committee to the conference it belongs to, so the secretariat sees it live. */
export function ConferenceLink({ cid, name, manage, say }: { cid: string; name: string; manage: boolean; say: Say }) {
  const [confs, setConfs] = useState<Conf[]>([]);
  const [link, setLink] = useState<Link_ | null>(null);
  const [conf, setConf] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => {
    if (!supabase) return;
    supabase.rpc("chamber_link", { cid }).then(({ data }) => { const l = data as Link_ | null; setLink(l); setConf(l?.conference_id ?? ""); });
    supabase.rpc("my_conferences").then(({ data }) => setConfs((data as Conf[] | null) ?? []));
  };
  useEffect(load, [cid]);
  // The committee shows on the conference's Manage page under its own name, as the chairs named it.
  const save = async (to: string | null) => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("link_chamber", { cid, conf: to, committee_name: name });
    setBusy(false);
    if (error) return say(error.message);
    say(to ? "Linked to the conference" : "Link removed");
    load();
  };
  const linked = Boolean(link?.conference_id);
  const same = conf === (link?.conference_id ?? "") && (!linked || link?.committee === name);
  return (
    <section className={`panel ${h.card}`} aria-labelledby="cl-h">
      <div className={h.head}><h2 id="cl-h" className={h.h2}>Conference</h2></div>
      {linked && <p className={h.note}>Linked to <Link className="link" href={`/conferences/${link!.slug}`}>{link!.name}</Link>. Its secretariat sees this committee live.</p>}
      {manage && (confs.length === 0 && !linked ? <p className={h.note}>You can link to a conference you help run. Ask its organisers to add you to the listing.</p> : (
        <>
          <div className="field">
            <label htmlFor="cl-conf" className="sr-only">Conference</label>
            <Select id="cl-conf" className="control" value={conf} onChange={(e) => setConf(e.target.value)}>
              <option value="">Not linked</option>
              {confs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              {linked && !confs.some((x) => x.id === link!.conference_id) && <option value={link!.conference_id!}>{link!.name}</option>}
            </Select>
          </div>
          {same
            ? <span className="tip" data-tip={linked ? "Already linked to this conference" : "Choose a conference first"} data-tip-align="start" style={{ display: "flex" }}><button type="button" className="button block" disabled>Save the Link</button></span>
            : <button type="button" className="button block" disabled={busy} onClick={() => void save(conf || null)}>{conf ? "Save the Link" : "Remove the Link"}</button>}
        </>
      ))}
    </section>
  );
}
