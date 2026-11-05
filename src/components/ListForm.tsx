"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import PageBand, { type BandProps } from "./PageBand";
import { FormSkeleton } from "./Skeleton";
import { Fragment, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { coverUrl, formatRange, webUrl, type Conference, type Role } from "@/lib/conferences";
import { useConferences } from "./ConferencesContext";
import { supabase } from "@/lib/supabase";
import { refreshSite } from "@/lib/refresh";
import { forgetListing, keptEditing, loadEditing, warmActivity, type EditingData } from "@/lib/listingData";
import { uploadPhoto } from "@/lib/photo";
import { isoToSydney, sydneyToIso } from "@/lib/schedule";
import { useAuth } from "./AuthProvider";
import { badGuide, badRole, CommitteesEditor, committeeRows, KeyDatesEditor, keyDateRows, RolesEditor, roleRows, SecretariatEditor, secretariatRows, strayGuides, toCommittees, toGuides, toKeyDates, toRoles, toSecretariat, type CommitteeRow, type KeyDateRow, type RoleRow, type SecretariatRow, type UploadGuide } from "./RowEditors";
import ListingNav from "./ListingNav";
import PanelTabs, { type PanelTab } from "./PanelTabs";
import Team, { type Member } from "./Team";
import auth from "@/app/auth.module.css";
import s from "@/app/inner.module.css";

type EditTab = "info" | "organisers";
const EDIT_TABS: PanelTab<EditTab>[] = [
  { id: "info", label: "Information", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 2.5h6l3 3v8h-9z" /><path d="M9.5 2.5v3h3M5.5 8.5h5M5.5 11h5" /></svg> },
  { id: "organisers", label: "Organisers", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="6" cy="5.5" r="2.3" /><path d="M1.8 13c.5-2.1 2.2-3.2 4.2-3.2s3.7 1.1 4.2 3.2M10.5 3.4a2.3 2.3 0 010 4.2M12 9.9c1.3.4 2.2 1.3 2.5 3.1" /></svg> },
];

type F = { name: string; label: string; type: "text" | "date" | "email" | "url" | "select" | "textarea" | "datetime-local"; wide?: boolean; required?: boolean; hint?: string; options?: string[] };

const FIELDS: F[] = [
  { name: "name", label: "Conference name", type: "text", wide: true, required: true },
  { name: "host", label: "Host school", type: "text", wide: true, required: true },
  { name: "start_date", label: "First day", type: "date" },
  { name: "end_date", label: "Last day", type: "date" },
  { name: "venue", label: "Venue", type: "text" },
  { name: "level", label: "Level", type: "select", options: ["High school", "University", "Open"] },
  { name: "contact", label: "Contact email", type: "email", required: true },
  { name: "fee", label: "Delegate fee", type: "text" },
  { name: "delegation_url", label: "Delegate registration link", type: "url" },
  { name: "delegation_opens", label: "Registration opens", type: "datetime-local", },
  { name: "chair_url", label: "Chair application link", type: "url" },
  { name: "chair_opens", label: "Chair applications open", type: "datetime-local", },
  { name: "interest_url", label: "Interest form link", type: "url", wide: true, hint: "Leave blank to collect interest on Collex" },
  { name: "overview", label: "Overview", type: "textarea", wide: true },
];

// The fee always starts with a dollar sign: it's shown inside the box, and added here whatever was typed or pasted.
const feeText = (raw: string) => { const x = raw.replace(/\$/g, "").trim(); return x ? `$${x}` : ""; };
const isUrl = (v: string) => /^https?:\/\/\S+\.\S+/.test(v);

// Cover photos: the kinds and size the storage bucket accepts.
const COVER_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const COVER_MAX = 5 * 1024 * 1024;
const GUIDE_MAX = 10 * 1024 * 1024;

// The fields an organiser can change on their listing, read back to fill the form.
type Editing = Record<string, string | null> & { id: string; status: string; guides: Conference["guides"]; committees: Conference["committees"] };
const asText = (e: Editing, k: string) => (e[k] as string | null) ?? "";
// The two scheduled buttons are typed as Sydney time but stored as instants.
const OPENS: Record<string, string> = { delegation_opens: "delegation_opens_at", chair_opens: "chair_opens_at" };

export default function ListForm() {
  const { ready, session } = useAuth();
  const router = useRouter();
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
  const [editing, setEditing] = useState<Editing | null | "missing" | "viewonly">(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [secretariat, setSecretariat] = useState<SecretariatRow[]>(() => secretariatRows());
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [keyDates, setKeyDates] = useState<KeyDateRow[]>(() => keyDateRows());
  // Guides whose committee has since been removed or renamed: kept as they were.
  const [stray, setStray] = useState<Conference["guides"]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [editTab, setEditTab] = useState<EditTab>("info");
  // Who can edit: the database lists the team only to the people on it (and admins), so an empty team means no access.
  const loadTeam = useCallback(async () => {
    if (!editId || !supabase) return [];
    forgetListing(editId); // the team changed, so kept copies of this listing are out of date
    const { data } = await supabase.rpc("organisers_of", { conf: editId });
    setTeam((data as Member[] | null) ?? []);
    return (data as Member[] | null) ?? [];
  }, [editId]);
  // Keyed on who is signed in, not on the session object, so a silent token refresh never reloads the form over unsaved edits.
  const userId = session?.user.id;
  // Fills the form from a listing's row and team.
  const apply = useCallback(({ row: data, members }: EditingData) => {
    // A view-only co-organiser can open the listing's activity, not its form (the database would refuse the save anyway).
    const me = members.find((m) => m.user_id === userId);
    const viewOnly = Boolean(me && !me.is_owner && me.role === "viewer");
    const row = members.length && !viewOnly ? (data as Editing | null) : null;
    setTeam(members);
    setEditing(viewOnly ? "viewonly" : row ?? "missing");
    setFirstDay((row?.start_date as string | undefined) ?? "");
    setLastDay((row?.end_date as string | undefined) ?? "");
    setCommittees(committeeRows(row?.committees ?? [], row?.guides ?? []));
    setSecretariat(secretariatRows((row?.secretariat as unknown as { role: string; name: string; photo?: string }[] | undefined) ?? []));
    setRoles(roleRows(row?.roles as unknown as Partial<Role>[] | undefined));
    setKeyDates(keyDateRows(row ? (row.key_dates as unknown as { label: string; date: string | null }[] | null) ?? [] : undefined));
    setStray(strayGuides(row?.committees ?? [], row?.guides ?? []));
  }, [userId]);
  // Layout effect, so a form whose listing was loaded a moment ago (from the Activity page) shows it on its first paint
  // instead of a skeleton. A kept copy is used as it is: the form never reloads over what someone has started typing.
  const [usedKept, setUsedKept] = useState(false);
  useLayoutEffect(() => {
    const id = new URLSearchParams(location.search).get("edit");
    setEditId(id);
    const kept = id && userId ? keptEditing(id) : undefined;
    if (kept) { apply(kept); setUsedKept(true); }
  }, [apply, userId]);
  useEffect(() => {
    if (!editId || !userId || !supabase || usedKept) return;
    loadEditing(editId).then((r) => { if (r) apply(r); });
  }, [editId, userId, usedKept, apply]);
  // The Activity page is the likely next stop, so its numbers load quietly.
  useEffect(() => { if (editId && userId) warmActivity(editId, userId); }, [editId, userId]);
  const edit = editing && editing !== "missing" && editing !== "viewonly" ? editing : null;
  // Other live listings on any of the same days. A heads-up only: two conferences can share a weekend.
  const listed = useConferences();
  const clashes = firstDay ? clashing(listed, firstDay, lastDay && lastDay >= firstDay ? lastDay : firstDay, edit?.id) : [];
  const firstBadGuide = committees.findIndex(badGuide);
  const firstBadRole = roles.findIndex(badRole);

  const check = (v: (k: string) => string) => {
    const out: Record<string, string> = {};
    if (!v("name")) out.name = "Add the conference's name.";
    if (!v("host")) out.host = "Add the school hosting it.";
    if (!v("contact")) out.contact = "Add an email so delegates can reach you.";
    else if (!/^\S+@\S+\.\S+$/.test(v("contact"))) out.contact = "That email doesn't look right.";
    if (v("start_date") && v("end_date") && v("end_date") < v("start_date")) out.end_date = "The last day is before the first day.";
    for (const k of ["delegation_url", "chair_url", "interest_url"]) if (v(k) && !isUrl(v(k))) out[k] = "Use a full link starting with https://";
    for (const [k, link] of [["delegation_opens", "delegation_url"], ["chair_opens", "chair_url"]]) {
      if (v(k) && !sydneyToIso(v(k))) out[k] = "That date and time doesn't look right.";
      else if (v(k) && !v(link)) out[k] = "Add the link this button opens first.";
    }
    if (!v("publish")) out.publish = "Tick the box to confirm before sending.";
    if (committees.some((r) => r.uploading)) out.guides = "Wait for the PDF to finish uploading.";
    else if (firstBadGuide >= 0) out.guides = "Fix the guide link marked below.";
    if (firstBadRole >= 0) out.roles = "Fix the apply link marked below.";
    else if (committees.some((r) => r.guide.trim() && !r.name.trim())) out.guides = "Name the committee a guide belongs to.";
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
      const el = (first === "guides" ? document.getElementById(firstBadGuide >= 0 ? `committee-${firstBadGuide}-guide` : "committee-0-first")
        : first === "roles" ? document.getElementById(`role-${firstBadRole}-url`) : form.elements.namedItem(first)) as HTMLElement | null;
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
    const guideList = toGuides(committees, stray);
    const people = toSecretariat(secretariat);
    const roleList = toRoles(roles);
    const dateList = toKeyDates(keyDates);
    const fields = {
      name: v("name"),
      host: v("host"),
      start_date: v("start_date") || null,
      end_date: v("end_date") || null,
      venue: v("venue"),
      level: v("level") || null,
      contact: v("contact"),
      fee: feeText(v("fee")),
      delegation_url: v("delegation_url") || null,
      chair_url: v("chair_url") || null,
      delegation_opens_at: v("delegation_opens") ? sydneyToIso(v("delegation_opens")) : null,
      chair_opens_at: v("chair_opens") ? sydneyToIso(v("chair_opens")) : null,
      interest_url: v("interest_url") || null,
      overview: v("overview"),
      committees: toCommittees(committees),
      ...cover,
    };
    // .select() returns the saved row, so an edit that changed nothing (no access any more) is caught, not shown as saved.
    const { data: saved, error } = edit
      ? await supabase.from("conferences").update({ ...fields, guides: guideList, secretariat: people, roles: roleList, key_dates: dateList }).eq("id", edit.id).select("id")
      : await supabase.from("conferences").insert({
          ...fields, ...(guideList.length ? { guides: guideList } : {}), ...(people.length ? { secretariat: people } : {}), ...(roleList.length ? { roles: roleList } : {}), ...(dateList.length ? { key_dates: dateList } : {}),
          submitted_by: session.user.id,
        }).select("id");
    setBusy(false);
    if (!error && !saved?.length) return setErrors({ form: "You can't edit this listing any more. Ask the person who listed it." });
    // New links or guides on a live listing queue emails to its followers; this sends them.
    if (!error && edit) { forgetListing(edit.id); supabase.functions.invoke("notify").catch(() => {}); }
    // A live listing's page shows the edit straight away.
    if (!error && edit?.status === "published") refreshSite().then(() => router.refresh());
    if (error) return setErrors({ form: error.message.startsWith("Too many listings") ? "You've sent 5 listings today. Try again tomorrow." : "Couldn't send it. Check your connection and try again." });
    setSent(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // A committee's background guide as a PDF: into this account's own folder, and its public address comes back.
  const uploadGuide: UploadGuide = async (file) => {
    if (file.type !== "application/pdf") return { error: "Use a PDF file." };
    if (file.size > GUIDE_MAX) return { error: "That PDF is over 10MB. Try a smaller one, or paste a link." };
    const path = `${session!.user.id}/${crypto.randomUUID()}.pdf`;
    const { error } = await supabase!.storage.from("guides").upload(path, file, { contentType: "application/pdf", cacheControl: "31536000" });
    if (error) return { error: "The PDF didn't upload. Try again, or paste a link." };
    return { url: supabase!.storage.from("guides").getPublicUrl(path).data.publicUrl };
  };

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
    ? {
        title: "Edit your", accent: "listing", lead: edit ? (edit.status === "published" ? "Changes show on the live page straight away." : "It's still in review. Your changes go with it.") : undefined,
        children: edit ? <ListingNav id={edit.id} slug={asText(edit, "slug")} current="edit" live={edit.status === "published"} canEdit /> : undefined,
      }
    : { title: "List a", accent: "conference", lead: "The Collex team reviews it before it goes live." };

  if (!ready || (editId && session && editing === null)) return page(listBand, <FormSkeleton fields={6} width={600} grid />);
  if (editId && editing === "missing") {
    return page({
      title: "Can\u2019t edit that", accent: "listing", lead: "Only the people who run a listing can edit it, while it\u2019s in review or live. Ask its organiser to invite you.",
      aside: <div className="btnStack one"><Link href="/listings" className="button lg">Your listings</Link></div>,
    }, null);
  }

  if (editId && editing === "viewonly") {
    return page({
      title: "View", accent: "only", lead: "The person who listed this conference set you to view only. You can see its activity, but not edit it.",
      aside: <div className="btnStack"><Link href={`/activity?id=${editId}`} className="button lg">See activity</Link><Link href="/listings" className="button secondary lg">Your listings</Link></div>,
    }, null);
  }

  if (!session) {
    return page({
      title: "List a", accent: "conference", lead: "Log in first. Your listing stays tied to your account, so you can track it.",
      aside: (
        <div className="btnStack">
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
        <div className="btnStack one">
          <Link href="/listings" className="button lg">{edit ? "Your listings" : "See its status"}</Link>
          {edit ? <button className="button secondary lg" onClick={() => setSent(false)}>Keep editing</button>
            : <button className="button secondary lg" onClick={() => { setSent(false); setCommittees([]); setStray([]); setSecretariat(secretariatRows()); setRoles([]); setKeyDates(keyDateRows()); }}>List another</button>}
        </div>
      </div>);
  }

  const formEl = (
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
                  maxLength={f.type === "datetime-local" ? undefined : f.type === "url" ? 500 : f.type === "email" ? 254 : f.name === "fee" ? 120 : 200}
                  defaultValue={edit ? (OPENS[f.name] ? isoToSydney(asText(edit, OPENS[f.name])) : asText(edit, f.name)) : f.name === "contact" ? session.user.email : undefined}
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
          {errors.guides && <small key="err" className={`t-reveal ${s.error}`}>{errors.guides}</small>}
          <CommitteesEditor rows={committees} setRows={(a) => { setCommittees(a); if (errors.guides) setErrors(({ guides: _, ...rest }) => rest); }} upload={uploadGuide} />
        </fieldset>
        <fieldset className={`field ${s.wide}`}>
          <legend>Key dates <span className="muted">(optional)</span></legend>
          <KeyDatesEditor rows={keyDates} setRows={setKeyDates} />
        </fieldset>
        <fieldset className={`field ${s.wide}`}>
          <legend>Secretariat <span className="muted">(optional)</span></legend>
          <SecretariatEditor rows={secretariat} setRows={setSecretariat} upload={(file) => uploadPhoto(file, session!.user.id)} />
        </fieldset>
        <fieldset className={`field ${s.wide}`}>
          <legend>Help wanted <span className="muted">(optional)</span></legend>
          {errors.roles && <small key="err" className={`t-reveal ${s.error}`}>{errors.roles}</small>}
          <RolesEditor rows={roles} setRows={(a) => { setRoles(a); if (errors.roles) setErrors(({ roles: _, ...rest }) => rest); }} />
        </fieldset>
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
            <div className="btnStack">
              <label htmlFor="f-cover" className="button secondary">Change photo</label>
              <button type="button" className="button secondary" onClick={removeCover}>Remove photo</button>
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
            <span key={String(busy)} className="t-swap">{edit ? (busy ? "Saving…" : "Update") : busy ? "Sending…" : "Send for review"}</span>
          </button>
          <small className="muted" style={{ textAlign: "center" }}><span className={s.req} aria-hidden="true">*</span> Required</small>
        </div>
      </form>
  );
  if (!edit) return page(listBand, formEl);
  return page(listBand,
    <div className={s.editShell}>
      <PanelTabs tabs={EDIT_TABS} tab={editTab} setTab={setEditTab} label="Edit your listing" idPrefix="edit" />
      <div id="edit-panel-info" role="tabpanel" aria-labelledby="edit-tab-info" hidden={editTab !== "info"}>{formEl}</div>
      <div id="edit-panel-organisers" role="tabpanel" aria-labelledby="edit-tab-organisers" hidden={editTab !== "organisers"}>
        <Team conf={edit.id} name={edit.name ?? "this listing"} me={session.user.id} team={team} reload={loadTeam} />
      </div>
    </div>);
}

/** Live listings running on any day from first to last, except the one being edited. */
function clashing(list: Conference[], first: string, last: string, except?: string) {
  return list.filter((c) => c.id !== except && c.startDate && c.startDate <= last && (c.endDate ?? c.startDate) >= first);
}

// Polite, not blocking: it names the clash so the organiser can decide. Always in the page, so screen readers hear it appear.
function ClashNote({ clashes }: { clashes: Conference[] }) {
  return (
    <>
      {/* Out of the layout, so an empty one adds no gap; it makes screen readers announce the note when it appears. */}
      <div className="sr-only" role="status">{clashes.length > 0 ? `Heads up: ${clashes.length === 1 ? "another conference runs" : `${clashes.length} conferences run`} on these dates.` : ""}</div>
      {clashes.length > 0 && (
        <div key={clashes.map((c) => c.id).join()} className={`t-reveal ${s.wide} ${s.clash}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2.2l6.2 11H1.8z" /><path d="M8 6.5v3M8 11.6v.1" /></svg>
          <p>
            {clashes.length === 1 ? <>Heads up: <Link href={`/conferences/${clashes[0].slug}`} className="link" target="_blank">{clashes[0].name}</Link> runs on {formatRange(clashes[0])}.</>
              : <>Heads up: {clashes.length} conferences run on these dates: {clashes.map((c, i) => <span key={c.id}>{i > 0 && (i === clashes.length - 1 ? " and " : ", ")}<Link href={`/conferences/${c.slug}`} className="link" target="_blank">{c.name}</Link></span>)}.</>}
            {" "}You can still list on these dates.
          </p>
        </div>
      )}
    </>
  );
}
