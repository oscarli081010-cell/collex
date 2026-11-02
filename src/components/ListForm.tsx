"use client";

import Link from "next/link";
import { useState } from "react";
import { NA } from "@/lib/conferences";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import s from "@/app/inner.module.css";

type F = { name: string; label: string; type: "text" | "date" | "email" | "url" | "select" | "textarea"; wide?: boolean; required?: boolean; hint?: string; options?: string[] };

const FIELDS: F[] = [
  { name: "name", label: "Conference name", type: "text", wide: true, required: true },
  { name: "host", label: "Host school", type: "text", required: true },
  { name: "submitter_role", label: "Your role", type: "text", hint: "For example, Secretary-General" },
  { name: "start_date", label: "First day", type: "date" },
  { name: "end_date", label: "Last day", type: "date" },
  { name: "venue", label: "Venue", type: "text" },
  { name: "level", label: "Level", type: "select", options: ["High school", "University", "Open"] },
  { name: "contact", label: "Contact email", type: "email", required: true },
  { name: "fee", label: "Delegate fee", type: "text", hint: "For example, $35 per delegate" },
  { name: "delegation_url", label: "Delegate registration link", type: "url", hint: "Powers the Register button" },
  { name: "chair_url", label: "Chair application link", type: "url", hint: "Powers the Apply to chair button" },
  { name: "overview", label: "Overview", type: "textarea", wide: true, hint: "A few sentences about the conference" },
  { name: "committees", label: "Committees", type: "textarea", wide: true, hint: "One per line, as Committee – Topic" },
];

const isUrl = (v: string) => /^https?:\/\/\S+\.\S+/.test(v);

// "UNSC – Arctic sovereignty" → { name, topic }
const parseCommittees = (text: string) =>
  text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, ...rest] = l.split(/\s+[–—-]\s+|:\s+/);
    return { name: name.trim(), topic: rest.join(" – ").trim() || NA, level: NA, chairs: NA };
  });

export default function ListForm() {
  const { ready, session } = useAuth();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firstDay, setFirstDay] = useState("");

  const check = (v: (k: string) => string) => {
    const out: Record<string, string> = {};
    if (!v("name")) out.name = "Add the conference's name.";
    if (!v("host")) out.host = "Add the school hosting it.";
    if (!v("contact")) out.contact = "Add an email so delegates can reach you.";
    else if (!/^\S+@\S+\.\S+$/.test(v("contact"))) out.contact = "That email doesn't look right.";
    if (v("start_date") && v("end_date") && v("end_date") < v("start_date")) out.end_date = "The last day is before the first day.";
    for (const k of ["delegation_url", "chair_url"]) if (v(k) && !isUrl(v(k))) out[k] = "Use a full link starting with https://";
    return out;
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !session) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const v = (k: string) => String(data.get(k) ?? "").trim();
    const found = check(v);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      const el = form.elements.namedItem(first) as HTMLElement | null;
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("conferences").insert({
      name: v("name"),
      host: v("host"),
      submitter_role: v("submitter_role"),
      start_date: v("start_date") || null,
      end_date: v("end_date") || null,
      venue: v("venue"),
      level: v("level") || null,
      contact: v("contact"),
      fee: v("fee"),
      delegation_url: v("delegation_url") || null,
      chair_url: v("chair_url") || null,
      overview: v("overview"),
      committees: parseCommittees(v("committees")),
      submitted_by: session.user.id,
    });
    setBusy(false);
    if (error) return setErrors({ form: "Couldn't send it. Check your connection and try again." });
    setSent(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const steps = (
    <aside className={`panel ${s.formAside}`}>
      <h2 className={s.h2}>What happens next</h2>
      <ol>
        <li>You send the listing. It goes to the Collex team for review.</li>
        <li>We check it, usually within two days.</li>
        <li>Once approved, it gets its page and joins the calendar.</li>
        <li>You&rsquo;ll see its status on your account page.</li>
      </ol>
    </aside>
  );

  if (!ready) return <div className={s.formGrid}><div className={`panel ${s.form}`} style={{ minHeight: 420 }} aria-busy="true" />{steps}</div>;

  if (!session) {
    return (
      <div className={s.formGrid}>
        <div className={`panel t-reveal ${s.form} ${s.sent}`}>
          <h2 className={s.h2}>Log in to list a conference</h2>
          <p className="muted">Listings are tied to an account, so you can track and update yours.</p>
          <div className={s.submitRow}>
            <Link href="/login" className="button lg">Log in</Link>
            <Link href="/signup" className="button secondary lg">Create an account</Link>
          </div>
        </div>
        {steps}
      </div>
    );
  }

  return (
    <div className={s.formGrid}>
      {sent ? (
        <div key="sent" role="status" className={`panel t-reveal ${s.form} ${s.sent}`}>
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className={s.sentIcon}><circle cx="20" cy="20" r="19" fill="var(--accent-soft)" /><path d="M13 20.5l5 5 9-10" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} /></svg>
          <h2 className={s.h2}>Sent for review</h2>
          <p className="muted">We&rsquo;ll check it and publish it, usually within two days. Track it on your account page.</p>
          <div className={s.submitRow}>
            <Link href="/account" className="button">See its status</Link>
            <button className="button secondary" onClick={() => setSent(false)}>List another</button>
          </div>
        </div>
      ) : (
      <form key="form" className={`panel t-reveal ${s.form}`} onSubmit={submit} noValidate>
        {FIELDS.map((f) => {
          const id = `f-${f.name}`;
          const err = errors[f.name];
          const hintId = err ? `${id}-err` : f.hint ? `${id}-hint` : undefined;
          const clear = () => err && setErrors(({ [f.name]: _, ...rest }) => rest);
          return (
            <div key={f.name} className={`field ${f.wide ? s.wide : ""} ${err ? s.invalid : ""}`}>
              <label htmlFor={id}>{f.label}{f.required ? <span className={s.req} aria-hidden="true"> *</span> : <span className="muted"> (optional)</span>}</label>
              {f.type === "select" ? (
                <select id={id} name={f.name} className="control" defaultValue="" onChange={clear}>
                  <option value="">Not sure yet</option>
                  {f.options!.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea id={id} name={f.name} className="control" aria-describedby={hintId} onChange={clear} />
              ) : (
                <input
                  id={id}
                  name={f.name}
                  type={f.type}
                  className="control"
                  defaultValue={f.name === "contact" ? session.user.email : undefined}
                  aria-invalid={Boolean(err)}
                  aria-describedby={hintId}
                  min={f.name === "end_date" ? firstDay || undefined : undefined}
                  onChange={(e) => { clear(); if (f.name === "start_date") setFirstDay(e.target.value); }}
                />
              )}
              {err
                ? <small key="err" id={hintId} className={`t-reveal ${s.error}`}>{err}</small>
                : f.hint && <small id={hintId}>{f.hint}</small>}
            </div>
          );
        })}
        <div className={`field ${s.wide}`}>
          {errors.form && <p key={errors.form} className={`t-reveal ${s.error}`}>{errors.form}</p>}
          <div className={s.submitRow}>
            <button type="submit" className="button lg" disabled={busy}>
              <span key={String(busy)} className="t-swap">{busy ? "Sending…" : "Send for review"}</span>
            </button>
            <small className="muted">Fields marked <span className={s.req}>*</span> are needed. Everything else can be added later.</small>
          </div>
        </div>
      </form>
      )}
      {steps}
    </div>
  );
}
