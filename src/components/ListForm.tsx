"use client";

import Link from "next/link";
import PageBand, { type BandProps } from "./PageBand";
import { FormSkeleton } from "./Skeleton";
import { Fragment, useCallback, useEffect, useState } from "react";
import { coverUrl, formatRange, webUrl, type Conference } from "@/lib/conferences";
import { useConferences } from "./ConferencesContext";
import { supabase } from "@/lib/supabase";
import { refreshSite } from "@/lib/refresh";
import { useAuth } from "./AuthProvider";
import { CommitteesEditor, committeeRows, GuidesEditor, guideRows, toCommittees, toGuides, type CommitteeRow, type GuideRow } from "./RowEditors";
import Team, { type Member } from "./Team";
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
  { name: "fee", label: "Delegate fee", type: "text" },
  { name: "delegation_url", label: "Delegate registration link", type: "url" },
  { name: "chair_url", label: "Chair application link", type: "url" },
  { name: "overview", label: "Overview", type: "textarea", wide: true },
];

// The fee always starts with a dollar sign: it's shown inside the box, and added here whatever was typed or pasted.
const feeText = (raw: string) => { const x = raw.replace(/\$/g, "").trim(); return x ? `$${x}` : ""; };
const isUrl = (v: string) => /^https?:\/\/\S+\.\S+/.test(v);

// Cover photos: the kinds and size the storage bucket accepts.
const COVER_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const COVER_MAX = 5 * 1024 * 1024;

// The fields an organiser can change on their listing, read back to fill the form.
type Editing = Record<string, string | null> & { id: string; status: string; guides: Conference["guides"]; committees: Conference["committees"] };
const asText = (e: Editing, k: string) => (e[k] as string | null) ?? "";

export default function ListForm() {
  const { ready, session } = useAuth();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firstDay, setFirstDay] = useState("");
  const [lastDay, setLastDay] = useState("");
  // A newly picked photo (uploaded on send), and what the picker shows: the new photo, the saved one, or nothing.
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  // ?edit=<id> opens one of your own listings for editing instead of a blank form.
  const [editing, setEditing] = useState<Editing | null | "missing">(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [guides, setGuides] = useState<GuideRow[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  useEffect(() => { setEditId(new URLSearchParams(location.search).get("edit")); }, []);
  // Who can edit: the database lists the team only to the people on it (and admins), so an empty team means no access.
  const loadTeam = useCallback(async () => {
    if (!editId || !supabase) return [];
    const { data } = await supabase.rpc("organisers_of", { conf: editId });
    setTeam((data as Member[] | null) ?? []);
    return (data as Member[] | null) ?? [];
  }, [editId]);
  useEffect(() => {
    if (!editId || !session || !supabase) return;
    Promise.all([
      supabase.from("conferences")
        .select("id, status, name, host, submitter_role, start_date, end_date, venue, level, contact, fee, delegation_url, chair_url, overview, committees, guides, cover_path")
        .eq("id", editId).in("status", ["pending", "published"]).maybeSingle(),
      loadTeam(),
    ]).then(([{ data }, members]) => {
      const row = members.length ? (data as Editing | null) : null;
      setEditing(row ?? "missing");
      setFirstDay(row?.start_date ?? "");
      setLastDay(row?.end_date ?? "");
      setCommittees(committeeRows(row?.committees ?? []));
      setGuides(guideRows(row?.guides ?? []));
    });
  }, [editId, session, loadTeam]);
  const edit = editing && editing !== "missing" ? editing : null;
  // Other live listings on any of the same days. A heads-up only: two conferences can share a weekend.
  const listed = useConferences();
  const clashes = firstDay ? clashing(listed, firstDay, lastDay && lastDay >= firstDay ? lastDay : firstDay, edit?.id) : [];
  const badGuides = guides.map((g, i) => (g.url.trim() && !webUrl(g.url) ? i : -1)).filter((i) => i >= 0);

  const check = (v: (k: string) => string) => {
    const out: Record<string, string> = {};
    if (!v("name")) out.name = "Add the conference's name.";
    if (!v("host")) out.host = "Add the school hosting it.";
    if (!v("contact")) out.contact = "Add an email so delegates can reach you.";
    else if (!/^\S+@\S+\.\S+$/.test(v("contact"))) out.contact = "That email doesn't look right.";
    if (v("start_date") && v("end_date") && v("end_date") < v("start_date")) out.end_date = "The last day is before the first day.";
    for (const k of ["delegation_url", "chair_url"]) if (v(k) && !isUrl(v(k))) out[k] = "Use a full link starting with https://";
    if (!v("publish")) out.publish = "Tick the box to confirm before sending.";
    if (badGuides.length) out.guides = "Fix the guide links marked below.";
    if (guides.some((g) => g.url.trim() && !g.committee)) out.guides = "Choose a committee for each guide.";
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
      const el = (first === "guides" ? document.getElementById("guide-0-first") : form.elements.namedItem(first)) as HTMLElement | null;
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setBusy(true);
    // Upload the photo first, into this account's own folder, so the listing only ever points at a file that exists.
    let cover: { cover_path: string | null } | null = coverRemoved ? { cover_path: null } : null;
    if (coverFile) {
      const path = `${session.user.id}/${crypto.randomUUID()}.${COVER_TYPES[coverFile.type]}`;
      const { error: upError } = await supabase.storage.from("covers").upload(path, coverFile, { contentType: coverFile.type, cacheControl: "31536000" });
      if (upError) { setBusy(false); return setErrors({ cover: "The photo didn't upload. Try again, or try a smaller one." }); }
      cover = { cover_path: path };
    }
    const fields = {
      name: v("name"),
      host: v("host"),
      submitter_role: v("submitter_role"),
      start_date: v("start_date") || null,
      end_date: v("end_date") || null,
      venue: v("venue"),
      level: v("level") || null,
      contact: v("contact"),
      fee: feeText(v("fee")),
      delegation_url: v("delegation_url") || null,
      chair_url: v("chair_url") || null,
      overview: v("overview"),
      committees: toCommittees(committees),
      ...cover,
    };
    // .select() returns the saved row, so an edit that changed nothing (no access any more) is caught, not shown as saved.
    const { data: saved, error } = edit
      ? await supabase.from("conferences").update({ ...fields, guides: toGuides(guides) }).eq("id", edit.id).select("id")
      : await supabase.from("conferences").insert({ ...fields, submitted_by: session.user.id }).select("id");
    setBusy(false);
    if (!error && !saved?.length) return setErrors({ form: "You can't edit this listing any more. Ask the person who listed it." });
    // New links or guides on a live listing queue emails to its followers; this sends them.
    if (!error && edit) supabase.functions.invoke("notify").catch(() => {});
    // A live listing's page shows the edit straight away.
    if (!error && edit?.status === "published") refreshSite();
    if (error) return setErrors({ form: error.message.startsWith("Too many listings") ? "You've sent 5 listings today. Try again tomorrow." : "Couldn't send it. Check your connection and try again." });
    setSent(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const savedCover = edit && !coverRemoved ? coverUrl(edit.cover_path) : null;
  const shownCover = coverPreview ?? savedCover;
  const pickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!COVER_TYPES[file.type]) return setErrors((x) => ({ ...x, cover: "Use a JPG, PNG or WebP photo." }));
    if (file.size > COVER_MAX) return setErrors((x) => ({ ...x, cover: "That photo is over 5 MB. Try a smaller one." }));
    setErrors(({ cover: _, ...rest }) => rest);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setCoverRemoved(false);
  };
  const removeCover = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
    setCoverRemoved(Boolean(edit?.cover_path));
  };

  // The headline band above every state of this page, with the state's content centred underneath.
  const page = (band: BandProps, body: React.ReactNode, after?: React.ReactNode) => (
    <>
      <PageBand size="md" {...band} />
      <div className={auth.body}>{body}{after}</div>
    </>
  );
  const listBand: BandProps = editId
    ? { title: "Edit your", accent: "listing", lead: edit ? (edit.status === "published" ? "Changes show on the live page straight away." : "It's still in review. Your changes go with it.") : undefined }
    : { title: "List a", accent: "conference", lead: "The Collex team reviews it before it goes live." };

  if (!ready || (editId && session && editing === null)) return page(listBand, <FormSkeleton fields={6} width={600} grid />);
  if (editId && editing === "missing") {
    return page({
      title: "Can\u2019t edit that", accent: "listing", lead: "Only the people who run a listing can edit it, while it\u2019s in review or live. Ask its organiser to invite you.",
      aside: <div className={auth.row}><Link href="/account#conferences" className="button lg">Your listings</Link></div>,
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
          <Link href="/account#conferences" className="button">{edit ? "Your listings" : "See its status"}</Link>
          {edit ? <button className="button secondary" onClick={() => setSent(false)}>Keep editing</button>
            : <button className="button secondary" onClick={() => { setSent(false); setCommittees([]); }}>List another</button>}
        </div>
      </div>);
  }

  return page(listBand,
      <form key={edit?.id ?? "form"} className={`t-reveal ${s.listForm}`} onSubmit={submit} noValidate>
        {FIELDS.map((f) => {
          const id = `f-${f.name}`;
          const err = errors[f.name];
          const hintId = err ? `${id}-err` : f.hint ? `${id}-hint` : undefined;
          const clear = () => err && setErrors(({ [f.name]: _, ...rest }) => rest);
          return (
            <Fragment key={f.name}>
            <div className={`field ${f.wide ? s.wide : ""} ${err ? s.invalid : ""}`}>
              <label htmlFor={id}>{f.label}{f.required ? <span className={s.req} aria-hidden="true"> *</span> : <span className="muted"> (optional)</span>}</label>
              {f.type === "select" ? (
                <select id={id} name={f.name} className="control" defaultValue={edit?.level ?? ""} onChange={clear}>
                  <option value="">Not sure yet</option>
                  {f.options!.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea id={id} name={f.name} className="control" maxLength={4000} defaultValue={edit ? asText(edit, f.name) : undefined} aria-invalid={Boolean(err)} aria-describedby={hintId} onChange={clear} />
              ) : f.name === "fee" ? (
                <span className={s.money}>
                  <span className={s.moneySign} aria-hidden="true">$</span>
                  <input
                    id={id}
                    name={f.name}
                    type="text"
                    className="control"
                    maxLength={119}
                    defaultValue={edit ? asText(edit, f.name).replace(/^\$\s*/, "") : undefined}
                    aria-invalid={Boolean(err)}
                    aria-describedby={hintId}
                    onChange={(e) => { clear(); e.target.value = e.target.value.replace(/\$/g, ""); }}
                  />
                </span>
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
                  onChange={(e) => { clear(); if (f.name === "start_date") setFirstDay(e.target.value); if (f.name === "end_date") setLastDay(e.target.value); }}
                />
              )}
              {err
                ? <small key="err" id={hintId} className={`t-reveal ${s.error}`}>{err}</small>
                : f.hint && <small id={hintId}>{f.hint}</small>}
            </div>
            {/* Right under the dates, across the form, while it matters. */}
            {f.name === "end_date" && <ClashNote clashes={clashes} />}
            </Fragment>
          );
        })}
        <fieldset className={`field ${s.wide}`}>
          <legend>Committees <span className="muted">(optional)</span></legend>
          <CommitteesEditor rows={committees} setRows={setCommittees} />
        </fieldset>
        {edit && (
          <fieldset className={`field ${s.wide} ${errors.guides ? s.invalid : ""}`}>
            <legend>Background guides <span className="muted">(optional)</span></legend>
            {errors.guides && <small key="err" className={`t-reveal ${s.error}`}>{errors.guides}</small>}
            <GuidesEditor rows={guides} setRows={(r) => { setGuides(r); if (errors.guides) setErrors(({ guides: _, ...rest }) => rest); }} committees={toCommittees(committees).map((c) => c.name)} error={badGuides} />
          </fieldset>
        )}
        <div className={`field ${s.wide} ${errors.cover ? s.invalid : ""}`}>
          <label htmlFor="f-cover">Cover photo <span className="muted">(optional)</span></label>
          <label htmlFor="f-cover" className={s.coverPick} data-filled={Boolean(shownCover)}>
            {shownCover
              // eslint-disable-next-line @next/next/no-img-element -- a local preview of the picked file
              ? <img src={shownCover} alt="The cover photo you picked" />
              : <span className={s.coverEmpty}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-8 8.5" /></svg>
                  Add a photo
                </span>}
          </label>
          <input id="f-cover" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-invalid={Boolean(errors.cover)} aria-describedby="f-cover-hint" onChange={pickCover} />
          {errors.cover
            ? <small key="err" id="f-cover-hint" className={`t-reveal ${s.error}`}>{errors.cover}</small>
            : <small id="f-cover-hint">JPG, PNG or WebP, up to 5MB.</small>}
          {shownCover && (
            <div className={auth.row}>
              <label htmlFor="f-cover" className="button secondary">Change photo</label>
              <button type="button" className={auth.textBtn} onClick={removeCover}>Remove</button>
            </div>
          )}
        </div>
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
          <small className="muted" style={{ textAlign: "center" }}><span className={s.req} aria-hidden="true">*</span> Required</small>
        </div>
      </form>,
      edit && session && <Team conf={edit.id} name={edit.name ?? "this listing"} me={session.user.id} team={team} reload={loadTeam} />);
}

/** Live listings running on any day from first to last, except the one being edited. */
function clashing(list: Conference[], first: string, last: string, except?: string) {
  return list.filter((c) => c.id !== except && c.startDate && c.startDate <= last && (c.endDate ?? c.startDate) >= first);
}

// Polite, not blocking: it names the clash so the organiser can decide. Always in the page, so screen readers hear it appear.
function ClashNote({ clashes }: { clashes: Conference[] }) {
  return (
    <div className={`${s.wide} ${s.clashSlot}`} role="status">
      {clashes.length > 0 && (
        <div key={clashes.map((c) => c.id).join()} className={`t-reveal ${s.clash}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2.2l6.2 11H1.8z" /><path d="M8 6.5v3M8 11.6v.1" /></svg>
          <p>
            {clashes.length === 1 ? <>Heads up: <Link href={`/conferences/${clashes[0].slug}`} className="link" target="_blank">{clashes[0].name}</Link> runs on {formatRange(clashes[0])}.</>
              : <>Heads up: {clashes.length} conferences run on these dates: {clashes.map((c, i) => <span key={c.id}>{i > 0 && (i === clashes.length - 1 ? " and " : ", ")}<Link href={`/conferences/${c.slug}`} className="link" target="_blank">{c.name}</Link></span>)}.</>}
            {" "}You can still list on these dates.
          </p>
        </div>
      )}
    </div>
  );
}
