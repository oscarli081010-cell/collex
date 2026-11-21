"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isPast, type Conference } from "@/lib/conferences";
import { whenOpens } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import SchoolPicker from "./SchoolPicker";
import { useOpen } from "./useOpen";
import s from "@/app/inner.module.css";

type Say = (msg: string) => void;
export type Mine = { id: string; school: string; status: "new" | "accepted" | "waitlisted" | "declined" } | null;

const SAYS: Record<string, string> = {
  new: "Delegation sent", accepted: "Delegation accepted", waitlisted: "Delegation waitlisted", declined: "Delegation not accepted",
};

/** The signed-in person's own registration for this conference, if they sent one. */
export function useMine(c: Conference) {
  const { session } = useAuth();
  const [mine, setMine] = useState<Mine | undefined>(undefined);
  useEffect(() => {
    if (!c.id || !session || !supabase) return setMine(null);
    supabase.from("registrations").select("id, school, status").eq("conference_id", c.id).eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setMine((data as Mine) ?? null));
  }, [c.id, session]);
  return [mine, setMine] as const;
}

// The "Register a delegation" card when the organisers take registrations on Collex.
export function RegisterCard({ c, mine, formOpen, setFormOpen, say, onWithdrawn }: {
  c: Conference; mine: Mine | undefined; formOpen: boolean; setFormOpen: (v: boolean) => void; say: Say; onWithdrawn: () => void;
}) {
  const { ready, session } = useAuth();
  const state = useOpen(c.delegationOpensAt);
  const [busy, setBusy] = useState(false);
  const finished = isPast(c);
  const waiting = Boolean(c.delegationOpensAt) && state === "closed";
  const hold = state === "unknown" || !ready || mine === undefined ? { visibility: "hidden" as const } : undefined;

  const withdraw = async () => {
    if (!supabase || !mine) return;
    setBusy(true);
    const { error } = await supabase.rpc("withdraw_registration", { reg: mine.id });
    setBusy(false);
    if (error) return say("That didn’t save. Try again.");
    say("Registration withdrawn");
    onWithdrawn();
  };

  const status = mine ? SAYS[mine.status] : finished ? "This conference has finished" : waiting ? `Opens ${whenOpens(c.delegationOpensAt!)}, Sydney time` : state === "open" ? "Registrations open" : "";
  return (
    <div className={s.applyOption}>
      <div>
        <h2 className={s.applyTitle}>Register a delegation</h2>
        <span className={s.applyStatus} data-open={Boolean(mine) || (state === "open")} style={hold} aria-live="polite">{status}</span>
      </div>
      {mine ? (
        <button className={`button secondary ${s.applyBtn}`} onClick={withdraw} disabled={busy} style={hold}>Withdraw Registration</button>
      ) : finished || waiting ? (
        <span className="tip" data-tip={finished ? "This conference has finished" : `Opens ${whenOpens(c.delegationOpensAt!)}, Sydney time`} style={hold}><button className={`button ${s.applyBtn}`} disabled data-closed>Register →</button></span>
      ) : !session ? (
        <Link href={`/login?next=${encodeURIComponent(`/conferences/${c.slug}`)}`} className={`button ${s.applyBtn}`} style={hold}>Log in to Register →</Link>
      ) : (
        <button className={`button ${s.applyBtn}`} style={hold} aria-expanded={formOpen} aria-controls="register-form" onClick={() => setFormOpen(!formOpen)}>
          <span key={String(formOpen)} className="t-swap">{formOpen ? "Close Form" : "Register →"}</span>
        </button>
      )}
    </div>
  );
}

// School, contact and how many delegates. The school's name comes from the same list as the profile; a school that
// isn't in it can still be typed.
export function RegisterForm({ c, say, onDone }: { c: Conference; say: Say; onDone: (m: Mine) => void }) {
  const { profile, session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase || !c.id || busy) return;
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    const delegates = Number(f.get("delegates"));
    if (text("school").length < 2) return setError("Add your school.");
    if (text("name").length < 2) return setError("Add a contact name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text("email"))) return setError("Add an email the organisers can reach.");
    if (!Number.isInteger(delegates) || delegates < 1 || delegates > 200) return setError("Delegates should be a number from 1 to 200.");
    setError(null);
    setBusy(true);
    const { data, error: err } = await supabase.rpc("register_delegation", {
      conf: c.id, school_name: text("school"), person_name: text("name"), person_email: text("email"), delegate_count: delegates, note: text("notes") || null,
    });
    setBusy(false);
    if (err) {
      setError(err.code === "23505" ? "You’ve already registered for this conference." : err.code === "42501" ? err.message : "That didn’t send. Try again.");
      return;
    }
    say("Delegation sent");
    onDone({ id: data as string, school: text("school"), status: "new" });
  };

  return (
    <form id="register-form" className={`t-reveal panel ${s.registerForm}`} onSubmit={submit} noValidate aria-label={`Register for ${c.name}`}>
      <div className="field"><span id="rg-school">School or University</span><SchoolPicker defaultValue={profile?.school ?? ""} /></div>
      <div className={s.registerRow}>
        <label className="field"><span>Contact name</span><input name="name" className="control" defaultValue={profile?.full_name ?? ""} autoComplete="name" maxLength={100} /></label>
        <label className="field"><span>Contact email</span><input name="email" type="email" className="control" defaultValue={session?.user.email ?? ""} autoComplete="email" maxLength={254} /></label>
        <label className="field"><span>Delegates</span><input name="delegates" type="number" inputMode="numeric" className="control" min={1} max={200} defaultValue={1} /></label>
      </div>
      <label className="field"><span>Anything the organisers should know <span className="muted">(optional)</span></span><textarea name="notes" className="control" maxLength={1000} rows={3} /></label>
      {error && <small role="alert" className="t-reveal" style={{ color: "var(--danger)" }}>{error}</small>}
      <button className="button lg block" disabled={busy}><span key={String(busy)} className="t-swap">{busy ? "Sending…" : "Send Registration"}</span></button>
    </form>
  );
}
