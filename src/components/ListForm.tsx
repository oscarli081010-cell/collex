"use client";

import Link from "next/link";
import PageBand, { type BandProps } from "./PageBand";
import { FormSkeleton } from "./Skeleton";
import { useEffect, useState } from "react";
import { NA, webUrl, type Conference } from "@/lib/conferences";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import auth from "@/app/auth.module.css";
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

// Only when editing: guides are added once a conference is live.
const GUIDES: F = { name: "guides", label: "Background guides", type: "textarea", wide: true, hint: "One per line, as Committee – https://link" };

const isUrl = (v: string) => /^https?:\/\/\S+\.\S+/.test(v);

// "UNSC – Arctic sovereignty" → { name, topic }
const parseCommittees = (text: string) =>
  text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [name, ...rest] = l.split(/\s+[–—-]\s+|:\s+/);
    return { name: name.trim(), topic: rest.join(" – ").trim() || NA, level: NA, chairs: NA };
  });

// "UNSC – https://…" → a released background guide. Keeps the release date of guides that were already there.
const parseGuides = (text: string, before: Conference["guides"]) =>
  text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(.*?)\s+[–—-]\s+(\S+)$/);
    const url = webUrl(m?.[2]);
    if (!m || !url) return null;
    const old = before.find((g) => g.url === url);
    return { committee: m[1].trim(), released: old?.released ?? new Date().toISOString().slice(0, 10), url };
  });

// The fields an organiser can change on their own listing, read back to fill the form.
type Editing = Record<string, string | null> & { id: string; status: string; guides: Conference["guides"]; committees: Conference["committees"] };
const asText = (e: Editing, k: string) =>
  k === "committees" ? e.committees.map((c) => (c.topic && c.topic !== NA ? `${c.name} – ${c.topic}` : c.name)).join("\n")
  : k === "guides" ? e.guides.filter((g) => g.url).map((g) => `${g.committee} – ${g.url}`).join("\n")
  : (e[k] as string | null) ?? "";

export default function ListForm() {
  const { ready, session } = useAuth();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firstDay, setFirstDay] = useState("");
  // ?edit=<id> opens one of your own listings for editing instead of a blank form.
  const [editing, setEditing] = useState<Editing | null | "missing">(null);
  const [editId, setEditId] = useState<string | null>(null);
  useEffect(() => { setEditId(new URLSearchParams(location.search).get("edit")); }, []);
  useEffect(() => {
    if (!editId || !session || !supabase) return;
    supabase.from("conferences")
      .select("id, status, name, host, submitter_role, start_date, end_date, venue, level, contact, fee, delegation_url, chair_url, overview, committees, guides")
      .eq("id", editId).eq("submitted_by", session.user.id).in("status", ["pending", "published"]).maybeSingle()
      .then(({ data }) => { setEditing((data as Editing) ?? "missing"); setFirstDay((data as Editing | null)?.start_date ?? ""); });
  }, [editId, session]);
  const edit = editing && editing !== "missing" ? editing : null;

  const check = (v: (k: string) => string) => {
    const out: Record<string, string> = {};
    if (!v("name")) out.name = "Add the conference's name.";
    if (!v("host")) out.host = "Add the school hosting it.";
    if (!v("contact")) out.contact = "Add an email so delegates can reach you.";
    else if (!/^\S+@\S+\.\S+$/.test(v("contact"))) out.contact = "That email doesn't look right.";
    if (v("start_date") && v("end_date") && v("end_date") < v("start_date")) out.end_date = "The last day is before the first day.";
    for (const k of ["delegation_url", "chair_url"]) if (v(k) && !isUrl(v(k))) out[k] = "Use a full link starting with https://";
    if (!v("publish")) out.publish = "Tick the box to confirm before sending.";
    if (v("guides") && parseGuides(v("guides"), []).some((g) => !g)) out.guides = "Write each guide as Committee – https://link";
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
    const fields = {
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
    };
    const { error } = edit
      ? await supabase.from("conferences").update({ ...fields, guides: parseGuides(v("guides"), edit.guides) }).eq("id", edit.id)
      : await supabase.from("conferences").insert({ ...fields, submitted_by: session.user.id });
    setBusy(false);
    // New links or guides on a live listing queue emails to its followers; this sends them.
    if (!error && edit) supabase.functions.invoke("notify").catch(() => {});
    if (error) return setErrors({ form: error.message.startsWith("Too many listings") ? "You've sent 5 listings today. Try again tomorrow." : "Couldn't send it. Check your connection and try again." });
    setSent(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // The headline band above every state of this page, with the state's content centred underneath.
  const page = (band: BandProps, body: React.ReactNode) => (
    <>
      <PageBand size="md" {...band} />
      <div className={auth.body}>{body}</div>
    </>
  );
  const listBand: BandProps = editId
    ? { title: "Edit your", accent: "listing", lead: edit ? (edit.status === "published" ? "Changes show on the live page straight away." : "It's still in review. Your changes go with it.") : undefined }
    : { title: "List a", accent: "conference", lead: "The Collex team reviews it before it goes live." };

  if (!ready || (editId && session && editing === null)) return page(listBand, <FormSkeleton fields={6} width={600} grid />);
  if (editId && editing === "missing") {
    return page({
      title: "Can\u2019t edit that", accent: "listing", lead: "Only the account that listed a conference can edit it, while it\u2019s in review or live.",
      aside: <div className={auth.row}><Link href="/account" className="button lg">Your listings</Link></div>,
    }, null);
  }

  if (!session) {
    return page({
      title: "List a", accent: "conference", lead: "Log in first. Your listing stays tied to your account, so you can track it.",
      aside: (
        <div className={auth.row}>
          <Link href="/login" className="button lg">Log in</Link>
          <Link href="/signup" className="button secondary lg">Create an account</Link>
        </div>
      ),
    }, null);
  }

  if (sent) {
    return page({
      title: edit ? "Changes" : "Sent for", accent: edit ? "saved" : "review",
      media: <svg width="56" height="56" viewBox="0 0 40 40" aria-hidden="true" className={s.sentIcon}><circle cx="20" cy="20" r="19" fill="var(--accent-soft)" /><path d="M13 20.5l5 5 9-10" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} /></svg>,
    },
      <div key="sent" role="status" className={`t-reveal ${auth.sent}`}>
        <ol className={`t-stagger ${s.next}`}>
          {(edit ? (edit.status === "published"
            ? ["They show on its page now.", "People following it get an email about new application links or guides.", "Each change is recorded, so the Collex team can see what changed."]
            : ["It's still in review.", "Once approved, it gets its own page and joins the calendar."])
          : ["The Collex team reviews it.", "Once approved, it gets its own page and joins the calendar.", "Its status shows on your account page the whole time."]).map((t, i) => (
            <li key={t} style={{ "--i": i } as React.CSSProperties}>{t}</li>
          ))}
        </ol>
        <div className={auth.row}>
          <Link href="/account" className="button">{edit ? "Your listings" : "See its status"}</Link>
          {edit ? <button className="button secondary" onClick={() => setSent(false)}>Keep editing</button>
            : <button className="button secondary" onClick={() => setSent(false)}>List another</button>}
        </div>
      </div>);
  }

  return page(listBand,
      <form key={edit?.id ?? "form"} className={`t-reveal ${s.listForm}`} onSubmit={submit} noValidate>
        {(edit ? [...FIELDS, GUIDES] : FIELDS).map((f) => {
          const id = `f-${f.name}`;
          const err = errors[f.name];
          const hintId = err ? `${id}-err` : f.hint ? `${id}-hint` : undefined;
          const clear = () => err && setErrors(({ [f.name]: _, ...rest }) => rest);
          return (
            <div key={f.name} className={`field ${f.wide ? s.wide : ""} ${err ? s.invalid : ""}`}>
              <label htmlFor={id}>{f.label}{f.required ? <span className={s.req} aria-hidden="true"> *</span> : <span className="muted"> (optional)</span>}</label>
              {f.type === "select" ? (
                <select id={id} name={f.name} className="control" defaultValue={edit?.level ?? ""} onChange={clear}>
                  <option value="">Not sure yet</option>
                  {f.options!.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea id={id} name={f.name} className="control" maxLength={4000} defaultValue={edit ? asText(edit, f.name) : undefined} aria-invalid={Boolean(err)} aria-describedby={hintId} onChange={clear} />
              ) : (
                <input
                  id={id}
                  name={f.name}
                  type={f.type}
                  className="control"
                  maxLength={f.type === "url" ? 500 : f.type === "email" ? 254 : ["fee", "submitter_role"].includes(f.name) ? 120 : 200}
                  defaultValue={edit ? asText(edit, f.name) : f.name === "contact" ? session.user.email : undefined}
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
          <label className={`check ${errors.publish ? "invalid" : ""}`} style={{ marginBottom: 8 }}>
            <input type="checkbox" name="publish" aria-invalid={Boolean(errors.publish)} aria-describedby={errors.publish ? "publish-err" : undefined} onChange={() => errors.publish && setErrors(({ publish: _, ...rest }) => rest)} />
            <span>I help run this conference or have its organisers&rsquo; permission, and I agree these details, including the contact email, will be public once approved. See the <Link href="/terms" target="_blank">Terms of use</Link>.</span>
          </label>
          {errors.publish && <p key="publish" id="publish-err" className={`t-reveal ${s.error}`}>{errors.publish}</p>}
          {errors.form && <p key={errors.form} className={`t-reveal ${s.error}`}>{errors.form}</p>}
          <button type="submit" className={`button lg ${auth.submit}`} disabled={busy}>
            <span key={String(busy)} className="t-swap">{busy ? "Sending…" : "Send for review"}</span>
          </button>
          <small className="muted" style={{ textAlign: "center" }}>Only fields marked <span className={s.req}>*</span> are needed. Add the rest later.</small>
        </div>
      </form>);
}
