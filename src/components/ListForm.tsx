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

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const body = FIELDS.map((f) => `${f.name}: ${String(data.get(f.name) ?? "").trim() || "N/A"}`).join("\n");
    const subject = `New listing: ${data.get("Conference name")}`;
    window.location.href = `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <div className={s.formGrid}>
      <form className={s.form} onSubmit={submit} data-reveal>
        {FIELDS.map((f) => {
          const id = `f-${f.name.replace(/\W+/g, "-").toLowerCase()}`;
          const hintId = "hint" in f ? `${id}-hint` : undefined;
          return (
            <div key={f.name} className={`${s.field} ${"wide" in f && f.wide ? s.wide : ""}`}>
              <label htmlFor={id}>{f.name}{"required" in f && f.required ? "" : " (optional)"}</label>
              {f.type === "select" ? (
                <select id={id} name={f.name} className={s.input} defaultValue="">
                  <option value="">Not sure yet</option>
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea id={id} name={f.name} className={s.input} aria-describedby={hintId} />
              ) : (
                <input
                  id={id}
                  name={f.name}
                  type={f.type}
                  className={s.input}
                  required={"required" in f && f.required}
                  aria-describedby={hintId}
                />
              )}
              {"hint" in f && <small id={hintId}>{f.hint}</small>}
            </div>
          );
        })}
        <div className={`${s.field} ${s.wide}`}>
          <button type="submit" className="button" style={{ alignSelf: "flex-start" }}>
            Send the listing <span className="arrow" aria-hidden="true">→</span>
          </button>
          {sent && (
            <p role="status" style={{ marginTop: 12 }}>
              Your email app should open with the listing written out. Send it and we&rsquo;ll reply within two days.
            </p>
          )}
        </div>
      </form>

      <aside className={s.formAside} data-reveal>
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
