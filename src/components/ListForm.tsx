"use client";

import { useState } from "react";
import { CONTACT } from "@/components/Footer";
import s from "@/app/inner.module.css";

const FIELDS = [
  { name: "Conference name", type: "text", wide: true, required: true },
  { name: "Host school", type: "text", required: true },
  { name: "Your role", type: "text", hint: "For example, Secretary-General" },
  { name: "First day", type: "date" },
  { name: "Last day", type: "date" },
  { name: "Venue", type: "text" },
  { name: "Suburb", type: "text" },
  { name: "Level", type: "select", options: ["High school", "University", "Open"] },
  { name: "Format", type: "select", options: ["In person", "Online", "Hybrid"] },
  { name: "Contact email", type: "email", required: true },
  { name: "Website or Instagram", type: "text" },
  { name: "Committees", type: "textarea", wide: true, hint: "One per line, with its topic if you have it" },
] as const;

// No backend yet: the form writes an email for the secretariat to send.
export default function ListForm() {
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firstDay, setFirstDay] = useState("");

  const check = (data: FormData) => {
    const out: Record<string, string> = {};
    const v = (k: string) => String(data.get(k) ?? "").trim();
    if (!v("Conference name")) out["Conference name"] = "Add the conference's name.";
    if (!v("Host school")) out["Host school"] = "Add the school hosting it.";
    if (!v("Contact email")) out["Contact email"] = "Add an email so we can confirm the listing.";
    else if (!/^\S+@\S+\.\S+$/.test(v("Contact email"))) out["Contact email"] = "That email doesn't look right.";
    if (v("First day") && v("Last day") && v("Last day") < v("First day")) out["Last day"] = "The last day is before the first day.";
    return out;
  };

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const found = check(data);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      const el = e.currentTarget.elements.namedItem(first) as HTMLElement | null;
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const body = FIELDS.map((f) => `${f.name}: ${String(data.get(f.name) ?? "").trim() || "N/A"}`).join("\n");
    const subject = `New listing: ${data.get("Conference name")}`;
    window.location.href = `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <div className={s.formGrid}>
      {sent ? (
        <div key="sent" role="status" className={`panel t-reveal ${s.form} ${s.sent}`}>
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className={s.sentIcon}><circle cx="20" cy="20" r="19" fill="var(--accent-soft)" /><path d="M13 20.5l5 5 9-10" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} /></svg>
          <h2 className={s.h2}>Your listing is written out</h2>
          <p className="muted">Your email app should have opened with every detail filled in. Send it and we&rsquo;ll reply within two days. If nothing opened, email {CONTACT}.</p>
          <button className="button secondary" onClick={() => setSent(false)}>Edit the listing</button>
        </div>
      ) : (
      <form key="form" className={`panel t-reveal ${s.form}`} onSubmit={submit} noValidate>
        {FIELDS.map((f) => {
          const id = `f-${f.name.replace(/\W+/g, "-").toLowerCase()}`;
          const err = errors[f.name];
          const hintId = err ? `${id}-err` : "hint" in f ? `${id}-hint` : undefined;
          const clear = () => err && setErrors(({ [f.name]: _, ...rest }) => rest);
          return (
            <div key={f.name} className={`field ${"wide" in f && f.wide ? s.wide : ""} ${err ? s.invalid : ""}`}>
              <label htmlFor={id}>{f.name}{"required" in f && f.required ? <span className={s.req} aria-hidden="true"> *</span> : <span className="muted"> (optional)</span>}</label>
              {f.type === "select" ? (
                <select id={id} name={f.name} className="control" defaultValue="" onChange={clear}>
                  <option value="">Not sure yet</option>
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea id={id} name={f.name} className="control" aria-describedby={hintId} onChange={clear} />
              ) : (
                <input
                  id={id}
                  name={f.name}
                  type={f.type}
                  className="control"
                  required={"required" in f && f.required}
                  aria-invalid={Boolean(err)}
                  aria-describedby={hintId}
                  min={f.name === "Last day" ? firstDay || undefined : undefined}
                  onChange={(e) => { clear(); if (f.name === "First day") setFirstDay(e.target.value); }}
                />
              )}
              {err
                ? <small key="err" id={hintId} className={`t-reveal ${s.error}`}>{err}</small>
                : "hint" in f && <small id={hintId}>{f.hint}</small>}
            </div>
          );
        })}
        <div className={`field ${s.wide}`}>
          <div className={s.submitRow}>
            <button type="submit" className="button lg">Write the listing email</button>
            <small className="muted">Fields marked <span className={s.req}>*</span> are needed. Everything else can be added later.</small>
          </div>
        </div>
      </form>
      )}

      <aside className={`panel ${s.formAside}`}>
        <h2 className={s.h2}>What happens next</h2>
        <ol>
          <li>Your email app opens with the listing written out. Send it.</li>
          <li>We reply to confirm, usually within two days.</li>
          <li>Your page goes live and the conference joins the calendar.</li>
          <li>Send committees and background guides whenever they&rsquo;re ready.</li>
        </ol>
      </aside>
    </div>
  );
}
