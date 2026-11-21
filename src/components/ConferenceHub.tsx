"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isPast, type Conference } from "@/lib/conferences";
import { whenOpens } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import SchoolPicker from "./SchoolPicker";
import Select from "./Select";
import { useOpen } from "./useOpen";
import { useToast } from "./useToast";
import h from "./Hub.module.css";

export type AppRow = {
  id: string; conference_id: string; kind: "delegate" | "chair" | "role"; role_title: string; name: string; school: string; year: string; experience: string;
  prefs: { committees?: string[]; countries?: string[] }; note: string; status: "new" | "accepted" | "waitlisted" | "declined" | "withdrawn";
  committee: string; country: string; allocation_sent_at: string | null; created_at: string; user_id?: string;
  /** When the applicant said they are coming. Missing until the database has the column. */
  confirmed_at?: string | null;
};
export const APP_KIND = (a: Pick<AppRow, "kind" | "role_title">) => (a.kind === "delegate" ? "Delegate" : a.kind === "chair" ? "Chair" : a.role_title || "Role");
export const APP_STATUS: Record<AppRow["status"], [string, string | undefined]> = { new: ["Sent", "warn"], accepted: ["Accepted", "ok"], waitlisted: ["Waitlisted", "warn"], declined: ["Not accepted", "bad"], withdrawn: ["Withdrawn", undefined] };
export const allocationText = (a: Pick<AppRow, "kind" | "committee" | "country">) =>
  !a.committee ? "" : a.kind === "chair" ? `Chairing ${a.committee}` : a.country ? `${a.country} in ${a.committee}` : a.committee;

const YEARS = ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "University", "Other"];

/* Apply to the conference as one person: a delegate, a chair, or for one of its open roles. Shown when the organisers
   take applications on Collex. The form remembers nothing but what the profile already has. */
export function ApplyOnCollex({ c }: { c: Conference }) {
  const { ready, session, profile } = useAuth();
  const { say, node } = useToast();
  const [mine, setMine] = useState<AppRow[] | null>(null);
  const [open, setOpen] = useState<"" | "delegate" | "chair" | "role">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roles = (c.roles ?? []).filter((r) => !r.url && r.kind !== "chair");
  // The buttons stay shut before the opening time and after the conference has finished. The database refuses the
  // finished case itself; the opening time is held here only.
  const delegateOpen = useOpen(c.delegationOpensAt);
  const chairOpen = useOpen(c.chairOpensAt);
  const finished = isPast(c);
  const gate = (kind: "delegate" | "chair" | "role") => {
    if (finished) return "This conference has finished";
    // Roles have no opening time of their own: they were never held back by the delegates' one.
    if (kind === "role") return "";
    const at = kind === "chair" ? c.chairOpensAt : c.delegationOpensAt;
    return at && (kind === "chair" ? chairOpen : delegateOpen) === "closed" ? `Opens ${whenOpens(at)}, Sydney time` : "";
  };
  const tipped = (why: string, b: React.ReactNode, key?: string) => (why ? <span key={key} className="tip" data-tip={why}>{b}</span> : b);

  const load = () => {
    if (!c.id || !session || !supabase) { setMine([]); return; }
    supabase.from("applications").select("id, conference_id, kind, role_title, name, school, year, experience, prefs, note, status, committee, country, allocation_sent_at, created_at")
      .eq("conference_id", c.id).eq("user_id", session.user.id).order("created_at")
      .then(({ data }) => setMine((data as AppRow[] | null) ?? []));
  };
  useEffect(load, [c.id, session]);

  if (!c.collexApplications || !c.id) return null;
  // A withdrawn application stays on record but no longer counts as one the person has.
  const current = (mine ?? []).filter((a) => a.status !== "withdrawn");
  const has = (k: string) => current.some((a) => a.kind === k);
  // What the form starts with: the person's own saved answers when they are changing an application, otherwise their profile.
  const saved = open ? current.find((a) => a.kind === open) : undefined;
  const picks = saved?.prefs?.committees ?? [];

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase || busy || !open) return;
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    if (text("name").length < 2) return setError("Add your name.");
    if (open === "role" && !text("role")) return setError("Choose the role.");
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.rpc("apply_to_conference", {
      conf: c.id, app_kind: open, app_role: open === "role" ? text("role") : "", person_name: text("name"), person_school: text("school"), person_year: text("year"),
      person_experience: text("experience"),
      app_prefs: { committees: [text("c1"), text("c2"), text("c3")].filter(Boolean), countries: text("countries").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 5) },
      app_note: text("note"),
    });
    setBusy(false);
    if (err) return setError(err.code === "42501" || err.code === "23505" || err.code === "54000" ? err.message : "That didn’t send. Try again.");
    say("Application sent");
    setOpen("");
    load();
  };
  const withdraw = async (a: AppRow) => {
    if (!supabase) return;
    const { error: err } = await supabase.rpc("withdraw_application", { app: a.id });
    if (err) return say("That didn’t save. Try again.");
    say("Application withdrawn");
    load();
  };

  return (
    <section id="apply-on-collex" className={`panel ${h.card}`} aria-labelledby="aoc-h" style={{ marginTop: 16 }}>
      <div className={h.head}>
        <h2 id="aoc-h" className={h.h2}>Apply on Collex</h2>
      </div>
      {mine && mine.length > 0 && (
        <ul className={h.rows}>
          {mine.map((a) => (
            <li key={a.id}>
              <span className={h.main}>
                <strong>{APP_KIND(a)} application</strong>
                <small>{a.status === "withdrawn" ? "You withdrew this application." : a.status === "accepted" && allocationText(a) ? `Your allocation: ${allocationText(a)}` : a.status === "new" ? "The organisers haven’t answered yet. You can still change or withdraw it." : "The organisers have answered."}</small>
              </span>
              <span className={h.btns}>
                <span className={h.chip} data-tone={APP_STATUS[a.status][1]}>{APP_STATUS[a.status][0]}</span>
                {a.status === "new" && <button type="button" className="button secondary sm" onClick={() => void withdraw(a)}>Withdraw</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!ready ? null : !session ? (
        <div className="btnStack one"><Link href={`/login?next=${encodeURIComponent(`/conferences/${c.slug}`)}`} className="button">Log in to Apply</Link></div>
      ) : (
        <div className={h.btnRow}>
          {tipped(gate("delegate"), <button type="button" className={open === "delegate" ? "button" : "button secondary"} aria-expanded={open === "delegate"} disabled={Boolean(gate("delegate"))} onClick={() => setOpen(open === "delegate" ? "" : "delegate")}>{has("delegate") ? "Change Delegate Application" : "Apply as a Delegate"}</button>)}
          {tipped(gate("chair"), <button type="button" className={open === "chair" ? "button" : "button secondary"} aria-expanded={open === "chair"} disabled={Boolean(gate("chair"))} onClick={() => setOpen(open === "chair" ? "" : "chair")}>{has("chair") ? "Change Chair Application" : "Apply to Chair"}</button>)}
          {roles.length > 0 && tipped(gate("role"), <button type="button" className={open === "role" ? "button" : "button secondary"} aria-expanded={open === "role"} disabled={Boolean(gate("role"))} onClick={() => setOpen(open === "role" ? "" : "role")}>Apply for a Role</button>)}
        </div>
      )}
      {open && session && (
        <form key={`${open}-${saved?.id ?? "new"}`} className={`t-reveal ${h.form}`} onSubmit={submit} noValidate aria-label={`Apply to ${c.name}`}>
          {open === "role" && (
            <div className="field">
              <label htmlFor="ap-role">Role</label>
              <Select id="ap-role" name="role" className="control" defaultValue={current.find((a) => a.kind === "role")?.role_title ?? ""}>
                <option value="">Choose a role…</option>
                {roles.map((r, i) => <option key={i} value={r.title}>{r.title}</option>)}
              </Select>
            </div>
          )}
          <div className={h.two}>
            <label className="field"><span>Your name</span><input name="name" className="control" defaultValue={saved?.name ?? profile?.full_name ?? ""} autoComplete="name" maxLength={100} /></label>
            <div className="field">
              <label htmlFor="ap-year">Year</label>
              <Select id="ap-year" name="year" className="control" defaultValue={saved?.year ?? ""}>
                <option value="">Choose…</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </div>
          </div>
          <div className="field"><span id="rg-school">School or University</span><SchoolPicker defaultValue={saved?.school ?? profile?.school ?? ""} /></div>
          {open !== "role" && c.committees.length > 0 && (
            <div className={h.three}>
              {[1, 2, 3].map((n) => (
                <div className="field" key={n}>
                  <label htmlFor={`ap-c${n}`}>{n === 1 ? "First" : n === 2 ? "Second" : "Third"} choice of committee</label>
                  <Select id={`ap-c${n}`} name={`c${n}`} className="control" defaultValue={c.committees.some((k) => k.name === picks[n - 1]) ? picks[n - 1] : ""}>
                    <option value="">No preference</option>
                    {c.committees.map((k) => <option key={k.name} value={k.name}>{k.name}</option>)}
                  </Select>
                </div>
              ))}
            </div>
          )}
          {open === "delegate" && <label className="field"><span>Countries you&rsquo;d like <span className="muted">(optional, separated by commas)</span></span><input name="countries" className="control" maxLength={200} placeholder="France, Brazil, Japan" defaultValue={(saved?.prefs?.countries ?? []).join(", ")} /></label>}
          <label className="field"><span>{open === "chair" ? "Your chairing and MUN experience" : "Your MUN experience"} <span className="muted">(optional)</span></span><textarea name="experience" className="control" rows={3} maxLength={800} defaultValue={saved?.experience ?? ""} /></label>
          <label className="field"><span>Anything the organisers should know <span className="muted">(optional)</span></span><textarea name="note" className="control" rows={2} maxLength={1000} defaultValue={saved?.note ?? ""} /></label>
          {error && <small role="alert" className={`t-reveal ${h.err}`}>{error}</small>}
          <button className="button lg block" disabled={busy}><span key={String(busy)} className="t-swap">{busy ? "Sending…" : "Send Application"}</span></button>
        </form>
      )}
      {node}
    </section>
  );
}

/* On a listing Collex added: its organisers ask to take it over. An admin checks the claim. */
export function ClaimListing({ c }: { c: Conference }) {
  const { session } = useAuth();
  const { say, node } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!c.id || !c.claimable) {
    return <p className="muted" style={{ fontSize: 13, padding: "12px 0 14px", borderTop: "1px solid var(--line)" }}>Run this conference? <Link className="link" href="/list">Update the listing</Link></p>;
  }
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase || busy) return;
    const f = new FormData(e.currentTarget);
    const role = String(f.get("role") ?? "").trim(), proof = String(f.get("proof") ?? "").trim();
    if (role.length < 2) return setError("Add your role at the conference.");
    if (proof.length < 10) return setError("Tell us how we can check you run it.");
    setError(null); setBusy(true);
    const { error: err } = await supabase.rpc("claim_listing", { conf: c.id, your_role: role, your_proof: proof });
    setBusy(false);
    if (err) return setError(err.code === "42501" || err.code === "23505" || err.code === "54000" ? err.message : "That didn’t send. Try again.");
    setSent(true); setOpen(false);
    say("Claim sent");
  };
  return (
    <div style={{ padding: "12px 0 14px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
      <p className="muted" style={{ fontSize: 13 }}>Collex added this listing from public information. {sent ? "Your claim is with us; we’ll email you." : "Run this conference?"}</p>
      {!sent && (session
        ? <button type="button" className="button secondary sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Close" : "Claim This Listing"}</button>
        : <Link href={`/login?next=${encodeURIComponent(`/conferences/${c.slug}`)}`} className="button secondary sm">Log in to Claim It</Link>)}
      {open && (
        <form className={`t-reveal ${h.form}`} onSubmit={submit} noValidate aria-label={`Claim ${c.name}`}>
          <label className="field"><span>Your role</span><input name="role" className="control" maxLength={80} placeholder="Secretary-General" /></label>
          <label className="field"><span>How we can check</span><textarea name="proof" className="control" rows={3} maxLength={800} placeholder="A school email, the conference’s page that names you, or a teacher we can contact" /></label>
          {error && <small role="alert" className={`t-reveal ${h.err}`}>{error}</small>}
          <button className="button block" disabled={busy}>{busy ? "Sending…" : "Send Claim"}</button>
        </form>
      )}
      {node}
    </div>
  );
}
