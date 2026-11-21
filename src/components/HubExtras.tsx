"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ROLE_KINDS, type RoleKind } from "@/lib/conferences";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { APP_KIND, APP_STATUS, allocationText, type AppRow } from "./ConferenceHub";
import { Gavel, Placard } from "./Drawings";
import PageBand from "./PageBand";
import QrCode from "./QrCode";
import Select from "./Select";
import board from "./board.module.css";
import ci from "./CheckIn.module.css";
import au from "@/app/auth.module.css";
import h from "./Hub.module.css";
import rs from "./Roles.module.css";

type Say = (t: string) => void;
const send = () => { supabase?.functions.invoke("mailer").catch(() => {}); };
const day = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "");

/* Roles page: an email when a conference lists new roles of the kinds you choose. */
export function RoleAlerts() {
  const { ready, session } = useAuth();
  const [kinds, setKinds] = useState<RoleKind[]>([]);
  const [saved, setSaved] = useState<RoleKind[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!session || !supabase) return;
    const off = new URLSearchParams(location.search).get("alerts") === "off";
    (async () => {
      if (off) { await supabase!.rpc("set_role_alert", { alert_kinds: null }); setMsg("Role alerts are off."); }
      const { data } = await supabase!.from("role_alerts").select("kinds").maybeSingle();
      const k = ((data?.kinds as RoleKind[] | undefined) ?? []);
      setSaved(k); setKinds(k);
    })();
  }, [session]);
  const save = async (next: RoleKind[]) => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_role_alert", { alert_kinds: next.length ? next : null });
    setBusy(false);
    if (error) { setMsg("That didn’t save. Try again."); return; }
    setSaved(next); setKinds(next);
    setMsg(next.length ? "Saved. We’ll email you when a conference lists one." : "Role alerts are off.");
  };
  const same = saved !== null && saved.length === kinds.length && saved.every((k) => kinds.includes(k));
  return (
    <section className={`panel ${h.card}`} aria-labelledby="ra-h" style={{ marginBottom: 20 }}>
      <div className={h.head}><h2 id="ra-h" className={h.h2}>Role Alerts</h2></div>
      <p className={h.note}>Get an email when a conference starts looking for the kinds of help you choose.</p>
      {!ready ? null : !session ? <div className="btnStack one"><Link href="/login?next=%2Froles" className="button block">Log in to Set an Alert</Link></div> : (
        <>
          <div className={rs.chips} role="group" aria-label="Kinds of role">
            {ROLE_KINDS.map((k) => {
              const on = kinds.includes(k.id);
              return (
                <button key={k.id} type="button" className={rs.chip} aria-pressed={on} onClick={() => setKinds(on ? kinds.filter((x) => x !== k.id) : [...kinds, k.id])}>
                  {on && <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>}
                  {k.label}
                </button>
              );
            })}
          </div>
          <button type="button" className="button block" disabled={busy || same} onClick={() => void save(kinds)}>{same && kinds.length ? "Alert Saved" : kinds.length ? "Save Alert" : saved?.length ? "Turn Alerts Off" : "Choose at Least One"}</button>
          {msg && <p className={h.note} role="status">{msg}</p>}
        </>
      )}
    </section>
  );
}

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

type Mine = AppRow & { conferences: { name: string; slug: string } | null; checkin_token: string; checked_in_at: string | null };

/* Account: the conferences you applied to as one person, and whether your record of them is public. */
export function MyApplications({ userId }: { userId: string }) {
  const { refresh } = useAuth();
  const [rows, setRows] = useState<Mine[] | null>(null);
  const [pub, setPub] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.from("applications").select("id, conference_id, kind, role_title, status, committee, country, created_at, checkin_token, checked_in_at, conferences(name, slug)").eq("user_id", userId).order("created_at", { ascending: false })
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
    <section className={`panel ${au.card}`} aria-labelledby="myapps-h">
      <div>
        <h2 id="myapps-h" className={au.cardTitle}>Your applications</h2>
      </div>
      {rows !== null && rows.length === 0 && (
        <div className={board.empty}><Gavel /><p className={board.emptyTitle}>No applications yet</p><p className="muted">Apply to chair or take a role at a conference and it shows here.</p><Link href="/roles" className="button secondary">See Open Roles</Link></div>
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
                  <span className={h.chip} data-tone={APP_STATUS[a.status][1]}>{APP_STATUS[a.status][0]}</span>
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
      <div className="field">
        <label className="check">
          <input type="checkbox" checked={Boolean(pub)} disabled={pub === null} onChange={(e) => void toggle(e.target.checked)} />
          <span>Make my MUN record public</span>
        </label>
      </div>
      <div className={h.btnRow}>
        <Link href={`/delegates/${userId}`} className="button secondary">See My Record</Link>
        {pub ? <button type="button" className="button secondary block" onClick={() => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>{copied ? "Link Copied" : "Copy the Link"}</button>
          : <span className="tip" data-tip="Make your record public first" data-tip-align="start" style={{ display: "flex" }}><button type="button" className="button secondary block" disabled>Copy the Link</button></span>}
      </div>
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
        <div className={board.empty}><Placard /><p className={board.emptyTitle}>This record isn&rsquo;t public</p><p className="muted">Its owner hasn&rsquo;t shared it, or the link is wrong.</p><Link href="/conferences" className="button secondary">See the Conferences</Link></div>
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
  useEffect(load, [cid]); // eslint-disable-line react-hooks/exhaustive-deps
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
