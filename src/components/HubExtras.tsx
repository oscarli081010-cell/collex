"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ROLE_KINDS, type RoleKind } from "@/lib/conferences";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { APP_KIND, APP_STATUS, allocationText, type AppRow } from "./ConferenceHub";
import { Placard } from "./Drawings";
import PageBand from "./PageBand";
import Select from "./Select";
import board from "./board.module.css";
import h from "./Hub.module.css";

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
          <div className={h.three} role="group" aria-label="Kinds of role">
            {ROLE_KINDS.map((k) => (
              <label key={k.id} className="check">
                <input type="checkbox" checked={kinds.includes(k.id)} onChange={(e) => setKinds(e.target.checked ? [...kinds, k.id] : kinds.filter((x) => x !== k.id))} />
                <span>{k.label}</span>
              </label>
            ))}
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
      <div className={h.head}><h2 id="claims-h" className={h.h2}>Claims on Listings<span className={h.count}>{rows.length}</span></h2></div>
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

type Mine = AppRow & { conferences: { name: string; slug: string } | null };

/* Account: the conferences you applied to as one person, and whether your record of them is public. */
export function MyApplications({ userId }: { userId: string }) {
  const { profile, refresh } = useAuth();
  const [rows, setRows] = useState<Mine[] | null>(null);
  const [pub, setPub] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    supabase.from("applications").select("id, conference_id, kind, role_title, status, committee, country, created_at, conferences(name, slug)").eq("user_id", userId).order("created_at", { ascending: false })
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
    <section className={`panel ${h.card}`} aria-labelledby="myapps-h" style={{ marginTop: 16 }}>
      <div className={h.head}><h2 id="myapps-h" className={h.h2}>Your Applications{rows && rows.length > 0 && <span className={h.count}>{rows.length}</span>}</h2></div>
      {rows === null ? <p className={h.note}>Loading…</p> : rows.length === 0 ? (
        <p className={h.note}>When you apply to a conference on Collex as a delegate or a chair, it shows here with the organisers&rsquo; answer and your allocation.</p>
      ) : (
        <ul className={h.rows}>
          {rows.map((a) => (
            <li key={a.id}>
              <span className={h.main}>
                <strong>{a.conferences ? <Link className="link" href={`/conferences/${a.conferences.slug}`}>{a.conferences.name}</Link> : "A conference"}</strong>
                <small>{APP_KIND(a)}{a.status === "accepted" && allocationText(a) ? ` · ${allocationText(a)}` : ""}</small>
              </span>
              <span className={h.btns}><span className={h.chip} data-tone={APP_STATUS[a.status][1]}>{APP_STATUS[a.status][0]}</span></span>
            </li>
          ))}
        </ul>
      )}
      <div className="field">
        <label className="check">
          <input type="checkbox" checked={Boolean(pub)} disabled={pub === null} onChange={(e) => void toggle(e.target.checked)} />
          <span>Make my MUN record public</span>
        </label>
        <small>A page with {profile?.full_name ? "your name" : "your name (add it in your profile)"}, your school, the conferences that accepted you and any awards published on Collex. Off unless you turn it on.</small>
      </div>
      <div className={h.btnRow}>
        <Link href={`/delegates/${userId}`} className="button secondary">See My Record</Link>
        <button type="button" className="button secondary" disabled={!pub} onClick={() => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>{copied ? "Link Copied" : "Copy the Link"}</button>
      </div>
    </section>
  );
}

type Rec = {
  name: string; school: string; public: boolean;
  conferences: { name: string; slug: string; start: string | null; kind: string; role: string; committee: string; country: string }[];
  awards: { title: string; committee: string; state: string; conference: string; slug: string; start: string | null }[];
};

/* A delegate's record: the conferences that accepted them and the awards chairs published. Only there when its owner made it public. */
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
        figures={[{ label: "Conferences", value: String(rec.conferences.length) }, { label: "Awards", value: String(rec.awards.length) }]} />
      {!rec.public && <p className={h.note} style={{ margin: "16px 0" }}>Only you can see this. Make it public from your account to share it.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
        <section className={`panel ${h.card}`} aria-labelledby="rec-a">
          <div className={h.head}><h2 id="rec-a" className={h.h2}>Awards</h2></div>
          {rec.awards.length === 0 ? <p className={h.note}>No awards published yet.</p> : (
            <div className={h.awards}>
              {rec.awards.map((a, i) => <div key={i} className={h.award}><small>{a.conference}{a.start ? ` · ${day(a.start)}` : ""}</small><strong>{a.title}</strong><span>{a.state} · {a.committee}</span></div>)}
            </div>
          )}
        </section>
        <section className={`panel ${h.card}`} aria-labelledby="rec-c">
          <div className={h.head}><h2 id="rec-c" className={h.h2}>Conferences</h2></div>
          {rec.conferences.length === 0 ? <p className={h.note}>No conferences yet.</p> : (
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

/* Chambers, Settings: link the committee to the conference it belongs to, so the secretariat sees it live and its awards can go on the conference's page. */
export function ConferenceLink({ cid, manage, awards, say }: { cid: string; manage: boolean; awards: number; say: Say }) {
  const [confs, setConfs] = useState<Conf[]>([]);
  const [link, setLink] = useState<Link_ | null>(null);
  const [conf, setConf] = useState("");
  const [committee, setCommittee] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => {
    if (!supabase) return;
    supabase.rpc("chamber_link", { cid }).then(({ data }) => { const l = data as Link_ | null; setLink(l); setConf(l?.conference_id ?? ""); setCommittee(l?.committee ?? ""); });
    supabase.rpc("my_conferences").then(({ data }) => setConfs((data as Conf[] | null) ?? []));
  };
  useEffect(load, [cid]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (to: string | null) => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("link_chamber", { cid, conf: to, committee_name: committee });
    setBusy(false);
    if (error) return say(error.message);
    say(to ? "Linked to the conference" : "Link removed");
    load();
  };
  const publish = async () => {
    if (!supabase) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("publish_awards", { cid });
    setBusy(false);
    if (error) return say(error.message);
    say(`${data} ${data === 1 ? "award" : "awards"} published on the conference’s page`);
  };
  const names = confs.find((x) => x.id === conf)?.committees ?? [];
  const linked = Boolean(link?.conference_id);
  return (
    <section className={`panel ${h.card}`} aria-labelledby="cl-h">
      <div className={h.head}><h2 id="cl-h" className={h.h2}>Conference</h2></div>
      <p className={h.note}>{linked ? <>Linked to <Link className="link" href={`/conferences/${link!.slug}`}>{link!.name}</Link>{link!.committee ? ` as ${link!.committee}` : ""}. Its secretariat sees this committee live from the listing&rsquo;s Manage page.</> : "Link this committee to the conference it is part of. Its secretariat then sees it live, and you can publish its awards to the conference’s page."}</p>
      {manage && (confs.length === 0 && !linked ? <p className={h.note}>You can link to a conference you help run. Ask its organisers to add you to the listing.</p> : (
        <>
          <div className={h.two}>
            <div className="field">
              <label htmlFor="cl-conf">Conference</label>
              <Select id="cl-conf" className="control" value={conf} onChange={(e) => { setConf(e.target.value); setCommittee(""); }}>
                <option value="">Not linked</option>
                {confs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                {linked && !confs.some((x) => x.id === link!.conference_id) && <option value={link!.conference_id!}>{link!.name}</option>}
              </Select>
            </div>
            <div className="field">
              <label htmlFor="cl-com">Committee</label>
              {names.length > 0 ? (
                <Select id="cl-com" className="control" value={committee} onChange={(e) => setCommittee(e.target.value)}>
                  <option value="">Choose…</option>
                  {names.map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              ) : <input id="cl-com" className="control" value={committee} maxLength={120} onChange={(e) => setCommittee(e.target.value)} placeholder="As it is named at the conference" disabled={!conf} />}
            </div>
          </div>
          <button type="button" className="button block" disabled={busy || (conf === (link?.conference_id ?? "") && committee === (link?.committee ?? ""))} onClick={() => void save(conf || null)}>{conf ? "Save the Link" : "Remove the Link"}</button>
        </>
      ))}
      {linked && <button type="button" className="button secondary block" disabled={busy || awards === 0} onClick={() => void publish()}>{awards ? `Publish ${awards} ${awards === 1 ? "Award" : "Awards"} to the Conference’s Page` : "Give Awards in Analytics to Publish Them"}</button>}
    </section>
  );
}
