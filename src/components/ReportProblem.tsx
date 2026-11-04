"use client";

import { useRef, useState } from "react";
import { lockScroll } from "@/lib/scrollLock";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import IconButton, { ICONS } from "./IconButton";
import s from "./ReportProblem.module.css";

const REASONS = [
  { id: "details", label: "Something is wrong or out of date", hint: "Dates, venue, fee, who's hosting" },
  { id: "link", label: "A link doesn't work", hint: "Registration, chair, guide or interest links" },
  { id: "inappropriate", label: "This shouldn't be here", hint: "Not a real conference, or not appropriate" },
  { id: "other", label: "Something else", hint: "" },
] as const;
type Reason = (typeof REASONS)[number]["id"];

// A button on a conference page that opens a short form. The report goes to the Collex team (admins), nowhere public.
export default function ReportProblem({ id, name }: { id: string; name: string }) {
  const { session } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const open = () => {
    setReason(null); setNote(""); setError(""); setDone(false);
    setEmail(session?.user.email ?? "");
    dialog.current?.showModal();
    lockScroll(true);
  };
  const close = () => dialog.current?.close();

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return setError("Choose what's wrong.");
    if (reason === "other" && !note.trim()) return setError("Say what's wrong.");
    if (!supabase) return setError("Reports aren't switched on yet. Email hello@collex.au instead.");
    setBusy(true); setError("");
    const { error: err } = await supabase.rpc("report_listing", { conf: id, reason, note: note.trim(), reply_to: email.trim() });
    setBusy(false);
    if (err) return setError(err.message.length < 140 ? err.message : "That didn't send. Try again, or email hello@collex.au.");
    setDone(true);
  }

  return (
    <>
      <button type="button" className={`button secondary block ${s.trigger}`} onClick={open}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 14V2.5M3.5 3h8.2l-1.6 2.7 1.6 2.8H3.5" /></svg>
        Report a problem
      </button>
      <dialog ref={dialog} className={s.dialog} aria-labelledby="report-h" onClose={() => lockScroll(false)} onClick={(e) => e.target === dialog.current && close()}>
        <form className={s.panel} onSubmit={send} noValidate>
          <div className={s.head}>
            <div>
              <h2 id="report-h" className={s.title}>Report a problem</h2>
              <p className={s.sub}>{name}</p>
            </div>
            <IconButton label="Close" tip="Close" icon={ICONS.close} onClick={close} />
          </div>
          {done ? (
            <div className={s.done} role="status">
              <svg width="56" height="56" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="var(--accent-soft)" /><path d="M13 20.5l5 5 9-10" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} /></svg>
              <p className={s.title} style={{ fontSize: 26 }}>Thanks, that helps.</p>
              <p className="muted">The Collex team will take a look{email.trim() ? " and may reply by email" : ""}.</p>
              <button type="button" className="button lg block" onClick={close}>Done</button>
            </div>
          ) : (
            <>
              <fieldset className={s.reasons}>
                <legend className="sr-only">What&rsquo;s wrong?</legend>
                {REASONS.map((r) => (
                  <label key={r.id} className={s.reason}>
                    <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => { setReason(r.id); setError(""); }} className="sr-only" />
                    <strong>{r.label}</strong>
                    {r.hint && <small>{r.hint}</small>}
                  </label>
                ))}
              </fieldset>
              <label className={s.field}>
                <span>Tell us more {reason === "other" ? <span className="muted">(needed)</span> : <span className="muted">(optional)</span>}</span>
                <textarea className="control" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
              </label>
              <label className={s.field}>
                <span>Your email, if you&rsquo;d like a reply <span className="muted">(optional)</span></span>
                <input className="control" type="email" value={email} maxLength={254} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
              </label>
              {error && <p className={s.error} role="alert">{error}</p>}
              <div className={s.actions}>
                <button type="submit" className="button lg block" disabled={busy}>
                  <span key={String(busy)} className="t-swap">{busy ? "Sending…" : "Send report"}</span>
                </button>
              </div>
            </>
          )}
        </form>
      </dialog>
    </>
  );
}
