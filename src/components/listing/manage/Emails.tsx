"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Select from "../../Select";
import Section from "../Section";
import type { ListingCtx } from "../types";
import { SYDNEY, sendMail, when } from "./shared";
import h from "../../Hub.module.css";

type Sent = { id: string; audience: string; subject: string; recipients: number; created_at: string };
const AUDIENCE: [string, string][] = [["accepted", "Everyone accepted"], ["applicants", "Everyone who applied"], ["delegates", "Accepted delegates"], ["chairs", "Accepted chairs"], ["schools", "Schools that registered a delegation"], ["followers", "People following the conference"]];
const TEMPLATES: { label: string; subject: string; body: string }[] = [
  { label: "Welcome and what happens next", subject: "Welcome", body: "Thank you for joining us.\n\nHere is what happens next: \n\nIf you have a question, reply to the organisers through the contact on our page." },
  { label: "Background guides are out", subject: "Background guides are out", body: "The background guides for every committee are now on our page. Position papers are due by ." },
  { label: "On the day", subject: "Everything you need for the day", body: "Arrive by  at .\n\nDress: Western business attire.\n\nBring: " },
];

// Emails from the organisers to the people involved, from ready-made starts. Sent from Collex, with the conference's name.
export default function Emails({ ctx }: { ctx: ListingCtx }) {
  const { c, canEdit, say } = ctx;
  const [to, setTo] = useState("accepted");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sent, setSent] = useState<Sent[]>([]);
  // How many people each group has right now, worked out the way the sending does, so the confirmation can say who gets it.
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const loadCounts = () => {
    const db = supabase;
    if (!db || !c.id) return;
    Promise.all([
      db.from("applications").select("user_id, kind, status").eq("conference_id", c.id),
      db.from("registrations").select("user_id, status").eq("conference_id", c.id),
      db.rpc("listing_followers", { conf: c.id }),
    ]).then(([apps, regs, follows]) => {
      const people = (rows: { user_id: string }[]) => new Set(rows.map((r) => r.user_id)).size;
      const a = ((apps.data ?? []) as { user_id: string; kind: string; status: string }[]).filter((x) => x.status !== "withdrawn");
      const accepted = a.filter((x) => x.status === "accepted");
      setCounts({
        applicants: apps.error ? NaN : people(a), accepted: apps.error ? NaN : people(accepted),
        delegates: apps.error ? NaN : people(accepted.filter((x) => x.kind === "delegate")), chairs: apps.error ? NaN : people(accepted.filter((x) => x.kind === "chair")),
        schools: regs.error ? NaN : people(((regs.data ?? []) as { user_id: string; status: string }[]).filter((x) => x.status !== "declined")),
        followers: follows.error || follows.data == null ? NaN : Number(follows.data),
      });
    });
  };
  useEffect(loadCounts, [c.id]);
  const load = () => {
    if (!supabase || !c.id) return;
    supabase.from("broadcasts").select("id, audience, subject, recipients, created_at").eq("conference_id", c.id).order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => setSent((data as Sent[] | null) ?? []));
  };
  useEffect(load, [c.id]);
  useEffect(() => { setArmed(false); }, [to, subject, body]);
  const ok = subject.trim().length >= 3 && body.trim().length >= 10;
  const go = async () => {
    if (!supabase || !ok || busy) return;
    if (!armed) { loadCounts(); setArmed(true); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("send_broadcast", { conf: c.id, to_audience: to, mail_subject: subject, mail_body: body });
    setBusy(false); setArmed(false);
    if (error) return say(error.message);
    say(data === 0 ? "Nobody is in that group yet, so nothing was sent" : `Sent to ${data} ${data === 1 ? "person" : "people"}`);
    setSubject(""); setBody("");
    sendMail(); load();
  };
  // A test goes only to the organiser, so it leaves the draft and the real button's state alone: they send the real one next.
  const test = async () => {
    if (!supabase || !ok || testing) return;
    setTesting(true);
    const { data, error } = await supabase.rpc("send_broadcast_test", { conf: c.id, mail_subject: subject, mail_body: body });
    setTesting(false);
    if (error) return say(error.message);
    say(`Test sent to ${data}`);
    sendMail();
  };
  const testWhyNot = !canEdit ? ctx.whyNot || "You can't send email for this conference" : !ok ? "Write a subject and a message first" : "";
  return (
    <Section id="sec-emails" title="Emails">
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
      <div className="field"><label htmlFor="mail-sub">Subject</label><input id="mail-sub" className="control" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} disabled={!canEdit} /></div>
      <div className="field"><label htmlFor="mail-body">Message</label><textarea id="mail-body" className="control" rows={7} value={body} maxLength={3000} onChange={(e) => setBody(e.target.value)} disabled={!canEdit} /></div>
      {armed && (() => {
        const n = counts?.[to];
        const group = AUDIENCE.find(([k]) => k === to)?.[1].toLowerCase() ?? "";
        return (
          <p className="muted" role="status">
            {n === undefined || Number.isNaN(n) ? `This goes to everyone in the group “${group}”. Click again to send it.`
              : n === 0 ? "Nobody is in that group yet, so nothing would be sent."
              : `This will email ${n} ${n === 1 ? "person" : "people"} (${group}). Click again to send it.`}
          </p>
        );
      })()}
      <div className="btnStack">
        {testWhyNot
          ? <span className="tip" data-tip={testWhyNot}><button type="button" className="button secondary" disabled>Send Me a Test</button></span>
          : <button type="button" className="button secondary" disabled={testing || busy} onClick={() => void test()}>{testing ? "Sending…" : "Send Me a Test"}</button>}
        <button type="button" className="button" disabled={!canEdit || !ok || busy || testing} onClick={() => void go()}>{busy ? "Sending…" : armed ? "Click Again to Send" : "Send Email"}</button>
      </div>
      {sent.length > 0 && <small className="muted">{SYDNEY}</small>}
      {sent.length > 0 && (
        <ul className={h.rows}>
          {sent.map((x) => (
            <li key={x.id}>
              <span className={h.main}><strong>{x.subject}</strong><small>{AUDIENCE.find(([k]) => k === x.audience)?.[1] ?? x.audience} · {x.recipients} {x.recipients === 1 ? "person" : "people"} · {when(x.created_at)}</small></span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
