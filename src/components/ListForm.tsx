"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import PageBand, { type BandProps } from "./PageBand";
import { FormSkeleton } from "./Skeleton";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { coverUrl, formatRange, todayInSydney, type Conference, type ConferenceSummary, type Role } from "@/lib/conferences";
import { useConferences } from "./ConferencesContext";
import { supabase } from "@/lib/supabase";
import { refreshSite } from "@/lib/refresh";
import { forgetListing, warmActivity, type EditingData } from "@/lib/listingData";
import { shrinkPhoto, uploadPhoto } from "@/lib/photo";
import { isoToSydney, sydneyToIso } from "@/lib/schedule";
import { useAuth } from "./AuthProvider";
import { badGuide, CommitteesEditor, committeeRows, firstRepeat, KeyDatesEditor, keyDateRows, roleRows, ScheduleEditor, scheduleRows, SecretariatEditor, secretariatRows, strayGuides, toCommittees, toGuides, toKeyDates, toRoles, toSchedule, toSecretariat, type CommitteeRow, type KeyDateRow, type RoleRow, type ScheduleRow, type SecretariatRow, type UploadGuide } from "./RowEditors";
import Section from "./listing/Section";
import { loadForm } from "./listing/loadForm";
import { impactOf, moveAllocations, norm, type Impact } from "./listing/committeeImpact";
import { Work } from "./listing/Shell";
import type { ListingCtx } from "./listing/types";
import auth from "@/app/auth.module.css";
import card from "./Manage.module.css";
import { Placard } from "./Drawings";
import board from "./board.module.css";
import s from "@/app/inner.module.css";
import Select from "./Select";
import CoverFrame from "./CoverFrame";
import { useToast } from "./useToast";
import lf from "./ListForm.module.css";

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
  { name: "delegation_opens", label: "Registration opens", type: "datetime-local", hint: "Sydney time. Leave empty to open it straight away." },
  { name: "chair_url", label: "Chair application link", type: "url" },
  { name: "chair_opens", label: "Chair applications open", type: "datetime-local", hint: "Sydney time. Leave empty to open it straight away." },
  { name: "interest_url", label: "Interest form link", type: "url", wide: true, hint: "Leave blank to collect interest on Collex" },
  { name: "overview", label: "Overview", type: "textarea", wide: true },
];

// The fee always starts with a dollar sign: it's shown inside the box, and added here whatever was typed or pasted.
const feeText = (raw: string) => { const x = raw.replace(/\$/g, "").trim(); return x ? `$${x}` : ""; };
const isUrl = (v: string) => /^https?:\/\/\S+\.\S+/.test(v);

// Cover photos: the kinds and size the storage bucket accepts.
const COVER_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const COVER_MAX = 5 * 1024 * 1024;
// A picked photo may be bigger than that: it is shrunk in the browser first, and only what is uploaded has to fit.
const COVER_PICK_MAX = 20 * 1024 * 1024;
const COVER_SIDE = 2000;
const GUIDE_MAX = 10 * 1024 * 1024;

// A photo field: a newly picked file (uploaded on send), what the picker shows (the new one, the saved one, or
// nothing), and where it is framed (percentages across and down; 50, 50 is the middle).
// One photo in the form: the picker, then the framing editor, then buttons to change or remove it.
function PhotoField({ id, label, frame, ratio, ph, error, hint }: {
  id: string; label: string; frame: string; ratio: number; ph: ReturnType<typeof usePhoto>; error?: string; hint?: string;
}) {
  return (
    <div className={`field ${error ? s.invalid : ""}`}>
      <label htmlFor={`f-${id}`}>{label} <span className="muted">(optional)</span></label>
      {ph.shown ? (
        <CoverFrame src={ph.shown} x={ph.at[0]} y={ph.at[1]} ratio={ratio} label={frame} onChange={(x, y) => ph.reframe([x, y])} />
      ) : (
        <label htmlFor={`f-${id}`} className={s.coverPick}>
          <span className={s.coverEmpty}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-8 8.5" /></svg>
            Add a photo
          </span>
        </label>
      )}
      <input id={`f-${id}`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-invalid={Boolean(error)} aria-describedby={`f-${id}-hint`} onChange={ph.pick} />
      {error
        ? <small key="err" id={`f-${id}-hint`} className={`t-reveal ${s.error}`}>{error}</small>
        : !ph.shown && <small id={`f-${id}-hint`}>{hint ? `${hint} ` : ""}JPG, PNG or WebP, up to 20MB.</small>}
      {ph.shown && (
        <div className="btnStack">
          <label htmlFor={`f-${id}`} className="button secondary">Change Photo</label>
          <button type="button" className="button secondary" onClick={ph.remove}>Remove Photo</button>
        </div>
      )}
    </div>
  );
}

// `touched` is called when the person changes the photo (picks, removes or reframes it), not when a saved one is loaded.
function usePhoto(saved: string | null | undefined, fail: (msg: string | null) => void, touched: () => void) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [at, setAt] = useState<[number, number]>([50, 50]);
  const [shrinking, setShrinking] = useState(false);
  // Shrinking takes a moment, so only the latest pick (or a remove after it) counts: an older one that finishes late is dropped.
  const latest = useRef(0);
  // Read when a slow pick finishes, so the preview shown by then is the one revoked, not the one shown when it started.
  const previewRef = useRef<string | null>(null);
  const show = (url: string | null) => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); previewRef.current = url; setPreview(url); };
  const savedUrl = saved && !removed ? coverUrl(saved) : null;
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const turn = ++latest.current;
    if (!COVER_TYPES[f.type]) { setShrinking(false); return fail("Use a JPG, PNG or WebP photo."); }
    if (f.size > COVER_PICK_MAX) { setShrinking(false); return fail("That photo is over 20 MB. Try a smaller one."); }
    setShrinking(true);
    const small = await shrinkPhoto(f, COVER_SIDE);
    if (turn !== latest.current) return;
    setShrinking(false);
    if (small.size > COVER_MAX) return fail("That photo is over 5 MB. Try a smaller one.");
    fail(null);
    setFile(small); show(URL.createObjectURL(small)); setRemoved(false); setAt([50, 50]); // a new photo starts in the middle
    touched();
  };
  const remove = () => { latest.current++; setShrinking(false); fail(null); show(null); setFile(null); setRemoved(Boolean(saved)); touched(); };
  const reframe = (to: [number, number]) => { setAt(to); touched(); };
  return { file, removed, at, setAt, reframe, shrinking, savedUrl, shown: preview ?? savedUrl, pick, remove };
}

// The fields an organiser can change on their listing, read back to fill the form.
type Editing = Record<string, string | null> & { id: string; status: string; guides: Conference["guides"]; committees: Conference["committees"] };
const asText = (e: Editing, k: string) => (e[k] as string | null) ?? "";
// The two scheduled buttons are typed as Sydney time but stored as instants.
const OPENS: Record<string, string> = { delegation_opens: "delegation_opens_at", chair_opens: "chair_opens_at" };

/** The form's cards, in order: what the list beside it jumps to. */
export const FORM_SECTIONS = [
  { id: "sec-details", label: "Details" }, { id: "sec-overview", label: "Overview" }, { id: "sec-keydates", label: "Key dates" },
  { id: "sec-schedule", label: "Schedule" }, { id: "sec-committees", label: "Committees" },
  { id: "sec-secretariat", label: "Secretariat" }, { id: "sec-photos", label: "Photos" },
];

// The form a conference is listed with. On its own it is the page for a new listing; given a listing, it is that
// listing's Edit tab, filled in with what it says now, and the workspace around it supplies the band and the tabs.
export default function ListForm({ listing }: { listing?: ListingCtx }) {
  const { ready, session } = useAuth();
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firstDay, setFirstDay] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [editing, setEditing] = useState<Editing | null | "missing" | "viewonly">(null);
  // When the listing was last saved, as loaded: an edit only goes through while it still reads that, so two organisers
  // editing at once can't overwrite each other. Every save moves it on.
  const stamp = useRef<string | null>(null);
  // Bumped when the form is loaded over again (after "Reload"), so its fields start from what was loaded.
  const [rev, setRev] = useState(0);
  // The edit was turned away because someone else saved first: the form offers to load their version.
  const [conflict, setConflict] = useState(false);
  // A rename or removal that touches allocations or choices, waiting for the person's say before it is saved.
  const [warn, setWarn] = useState<Impact | null>(null);
  const confirmed = useRef<"" | "plain" | "alloc">("");
  const saving = useRef(false);
  const formEl = useRef<HTMLFormElement>(null);
  const editId = listing?.id ?? null;
  const editRow = editing && typeof editing === "object" ? editing : null;
  // Changes not yet saved. Only what the person does sets it: loading the listing into the form uses the plain setters.
  // `edits` counts every change, so a save only clears the flag if nothing was changed while it was being sent.
  const [dirty, setDirty] = useState(false);
  const edits = useRef(0);
  const touch = useCallback(() => { edits.current++; setDirty(true); }, []);
  const coverPhoto = usePhoto(editRow?.cover_path, (m) => setErrors(({ cover: _, ...rest }) => (m ? { ...rest, cover: m } : rest)), touch);
  const thumbPhoto = usePhoto(editRow?.thumb_path, (m) => setErrors(({ thumb: _, ...rest }) => (m ? { ...rest, thumb: m } : rest)), touch);
  const [committees, setCommittees] = useState<CommitteeRow[]>([]);
  const [secretariat, setSecretariat] = useState<SecretariatRow[]>(() => secretariatRows());
  // Roles already on a listing ride along untouched: the form no longer edits them.
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [keyDates, setKeyDates] = useState<KeyDateRow[]>(() => keyDateRows());
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  // Guides whose committee has since been removed or renamed: kept as they were.
  const [stray, setStray] = useState<Conference["guides"]>([]);
  // Keyed on who is signed in, not on the session object, so a silent token refresh never reloads the form over unsaved edits.
  const userId = session?.user.id;
  const { setAt: setCoverAt } = coverPhoto;
  const { setAt: setThumbAt } = thumbPhoto;
  // Fills the form from a listing's row and team.
  const apply = useCallback(({ row: data, members }: EditingData) => {
    // A view-only co-organiser can open the listing's activity, not its form (the database would refuse the save anyway).
    const me = members.find((m) => m.user_id === userId);
    const viewOnly = Boolean(me && !me.is_owner && me.role === "viewer");
    const row = members.length && !viewOnly ? (data as Editing | null) : null;
    stamp.current = (row?.updated_at as string | undefined) ?? null;
    setEditing(viewOnly ? "viewonly" : row ?? "missing");
    setFirstDay((row?.start_date as string | undefined) ?? "");
    setLastDay((row?.end_date as string | undefined) ?? "");
    setCommittees(committeeRows(row?.committees ?? [], row?.guides ?? []));
    setSecretariat(secretariatRows((row?.secretariat as unknown as { role: string; name: string; photo?: string }[] | undefined) ?? []));
    setRoles(roleRows(row?.roles as unknown as Partial<Role>[] | undefined));
    setKeyDates(keyDateRows(row ? (row.key_dates as unknown as { label: string; date: string | null }[] | null) ?? [] : undefined));
    setSchedule(scheduleRows(row?.schedule));
    setStray(strayGuides(row?.committees ?? [], row?.guides ?? []));
    const at = (k: string) => { const n = Number((row as Record<string, unknown> | null)?.[k]); return row?.[k] != null && Number.isFinite(n) ? n : 50; };
    setCoverAt([at("cover_x"), at("cover_y")]);
    setThumbAt([at("thumb_x"), at("thumb_y")]);
  }, [userId, setCoverAt, setThumbAt]);
  // The listing is read fresh when the form opens (never from a copy kept earlier), so the time it was last saved is true.
  // Nothing reloads it over what someone has started typing: only the person's own "Reload" does.
  useEffect(() => {
    if (!editId || !userId || !supabase) return;
    let on = true;
    loadForm(editId).then((r) => { if (on && r) apply(r); });
    return () => { on = false; };
  }, [editId, userId, apply]);
  // Loads the listing again, discarding what was typed, and starts the form over from it.
  const reloadForm = async () => {
    if (!editId) return;
    const r = await loadForm(editId);
    if (!r) return say.current("Couldn’t reload it. Check your connection and try again.");
    apply(r); setRev((n) => n + 1); setDirty(false); setConflict(false); setWarn(null); setErrors({});
  };
  // The Activity page is the likely next stop, so its numbers load quietly.
  useEffect(() => { if (editId && userId) warmActivity(editId, userId); }, [editId, userId]);
  const edit = editing && editing !== "missing" && editing !== "viewonly" ? editing : null;
  // Other live listings on any of the same days. A heads-up only: two conferences can share a weekend.
  const listed = useConferences();
  const clashes = firstDay ? clashing(listed, firstDay, lastDay && lastDay >= firstDay ? lastDay : firstDay, edit?.id) : [];
  const firstBadGuide = committees.findIndex(badGuide);
  // A committee renamed to the name of one removed in the same save: the people in the removed one would silently end up
  // in the renamed one. It has to be done in two saves.
  const removedNames = new Set((edit?.committees ?? []).map((k) => norm(k.name)).filter((n) => n && !committees.some((r) => r.was && norm(r.was) === n)));
  const firstTaken = committees.findIndex((r) => r.was && r.name.trim() && norm(r.name) !== norm(r.was) && removedNames.has(norm(r.name)));
  const firstRepeated = firstRepeat(committees) >= 0 ? firstRepeat(committees) : firstTaken;
  // A listing that was sent back or taken down is saved and sent for review again in one step.
  const again = Boolean(edit && (edit.status === "rejected" || edit.status === "unpublished"));

  // On the new-listing page the form has its own toast; in a listing's workspace, the workspace's.
  const toast = useToast();
  const say = useRef(toast.say);
  useEffect(() => { say.current = listing ? listing.say : toast.say; });
  // While there are unsaved changes: closing or reloading the tab asks first, and leaving by a link takes a second click
  // (the site's "click again to confirm"). The first click is stopped before Next's links or the tabs see it.
  useEffect(() => {
    if (!dirty) return;
    let warnedAt = 0;
    // A page the person chose to leave by a second click doesn't ask again as it unloads.
    let leftAt = 0;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (Date.now() - leftAt < 1000) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!(e.target instanceof Element)) return;
      const a = e.target.closest("a[href]");
      if (!a) return;
      // Links that open somewhere else, or download, leave this page as it is.
      const target = a.getAttribute("target");
      if ((target && !["_self", "_top", "_parent"].includes(target)) || a.hasAttribute("download")) return;
      let to: URL;
      try { to = new URL(a.getAttribute("href")!, window.location.href); } catch { return; }
      if (to.protocol !== "http:" && to.protocol !== "https:") return; // mailto: and the like
      const here = window.location;
      if (to.origin === here.origin && to.pathname === here.pathname && to.search === here.search) return; // only the hash differs
      if (Date.now() - warnedAt < 4000) { warnedAt = 0; leftAt = Date.now(); return; }
      e.preventDefault();
      e.stopPropagation();
      warnedAt = Date.now();
      say.current("You have unsaved changes. Click again to leave without saving.");
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const check = (v: (k: string) => string) => {
    const out: Record<string, string> = {};
    if (!v("name")) out.name = "Add the conference's name.";
    if (!v("host")) out.host = "Add the school hosting it.";
    if (!v("contact")) out.contact = "Add an email so delegates can reach you.";
    else if (!/^\S+@\S+\.\S+$/.test(v("contact"))) out.contact = "That email doesn't look right.";
    if (v("start_date") && v("end_date") && v("end_date") < v("start_date")) out.end_date = "The last day can’t be before the first day.";
    for (const k of ["delegation_url", "chair_url", "interest_url"]) if (v(k) && !isUrl(v(k))) out[k] = "Use a full link starting with https://";
    for (const [k, link] of [["delegation_opens", "delegation_url"], ["chair_opens", "chair_url"]]) {
      if (v(k) && !sydneyToIso(v(k))) out[k] = "That date and time doesn't look right.";
      else if (v(k) && !v(link)) out[k] = "Add the link this button opens first.";
    }
    if (!edit && !v("publish")) out.publish = "Tick the box to confirm before sending.";
    // A photo still being shrunk isn't in the form yet: saving now would leave it out.
    if (coverPhoto.shrinking) out.cover = "Wait for the photo to finish loading.";
    if (thumbPhoto.shrinking) out.thumb = "Wait for the photo to finish loading.";
    if (firstRepeat(committees) >= 0) out.committees = "Two committees have the same name. Rename or remove one.";
    else if (firstTaken >= 0) out.committees = "This name belongs to a committee you removed. Save the removal first, then rename.";
    if (committees.some((r) => r.uploading)) out.guides = "Wait for the PDF to finish uploading.";
    else if (firstBadGuide >= 0) out.guides = "Fix the guide link marked below.";
    if (committees.some((r) => r.guide.trim() && !r.name.trim())) out.guides = "Name the committee a guide belongs to.";
    return out;
  };

  // Why an edit changed nothing, found by reading the listing again.
  const whyNotSaved = async (id: string): Promise<{ text: string; conflict: boolean }> => {
    const r = await loadForm(id);
    if (!r) return { text: "Couldn’t send it. Check your connection and try again.", conflict: false };
    const me = r.members.find((m) => m.user_id === userId);
    if (!r.row || !r.members.length || (me && !me.is_owner && me.role === "viewer")) return { text: "You no longer have access to this listing.", conflict: false };
    if (String(r.row.updated_at ?? "") !== stamp.current) return { text: "Someone else changed this listing while you were editing. Reload to see their changes.", conflict: true };
    if (again && (r.row.status === "rejected" || r.row.status === "unpublished")) return { text: "This listing can’t be sent for review again yet. Try again in a few minutes.", conflict: false };
    if (r.row.status === "pending") return { text: "This listing is being reviewed and can’t be edited right now.", conflict: false };
    return { text: "You can’t edit this listing any more. Ask the person who listed it.", conflict: false };
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !session) return;
    // One save at a time: a second press while the first is still checking or sending would be turned away as a clash.
    if (saving.current) return;
    saving.current = true;
    try { await save(e.currentTarget); } finally { saving.current = false; }
  }

  async function save(form: HTMLFormElement) {
    if (!supabase || !session) return;
    const data = new FormData(form);
    const v = (k: string) => String(data.get(k) ?? "").trim();
    const found = check(v);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      confirmed.current = "";
      const el = (first === "committees" ? document.getElementById(`committee-${firstRepeated}-first`)
        : first === "guides" ? document.getElementById(firstBadGuide >= 0 ? `committee-${firstBadGuide}-guide` : "committee-0-first")
        : first === "cover" || first === "thumb" ? document.getElementById(`f-${first}`) : form.elements.namedItem(first)) as HTMLElement | null;
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    // Renaming or removing a committee people are already placed in or chose: say so first, and let the person decide.
    if (edit && !confirmed.current) {
      const hit = await impactOf(edit.id, committees, (edit.committees ?? []).map((k) => k.name));
      if (hit) { setWarn(hit); return; }
    }
    const also = confirmed.current === "alloc" ? warn : null;
    confirmed.current = "";
    setWarn(null);
    setConflict(false);
    setBusy(true);
    const seen = edits.current;
    // Upload the photos first, into this account's own folder, so the listing only ever points at files that exist.
    const upload = async (f: File) => {
      const path = `${session.user.id}/${crypto.randomUUID()}.${COVER_TYPES[f.type]}`;
      const { error: upError } = await supabase!.storage.from("covers").upload(path, f, { contentType: f.type, cacheControl: "31536000" });
      return upError ? null : path;
    };
    const photo = async (ph: typeof coverPhoto, key: "cover" | "thumb") => {
      const pos = ph.file || ph.savedUrl ? { [`${key}_x`]: ph.at[0], [`${key}_y`]: ph.at[1] } : ph.removed ? { [`${key}_x`]: null, [`${key}_y`]: null } : {};
      if (!ph.file) return { ...(ph.removed ? { [`${key}_path`]: null } : {}), ...pos };
      const path = await upload(ph.file);
      return path ? { [`${key}_path`]: path, ...pos } : null;
    };
    const cover = await photo(coverPhoto, "cover");
    const thumb = cover && await photo(thumbPhoto, "thumb");
    if (!cover || !thumb) { setBusy(false); return setErrors({ [cover ? "thumb" : "cover"]: "The photo didn't upload. Try again, or try a smaller one." }); }
    const sentRows = committees;
    const guideList = toGuides(committees, stray);
    const people = toSecretariat(secretariat);
    const roleList = toRoles(roles);
    const dateList = toKeyDates(keyDates);
    const scheduleList = toSchedule(schedule);
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
      // Each photo with where it is framed; a removed photo clears both.
      ...cover, ...thumb,
    };
    // Only where the listing still reads as it did when it was loaded, and .select() hands the saved row back: an edit that
    // changed nothing (someone else saved first, or access ended) is caught and explained, not shown as saved.
    const changes = { ...fields, guides: guideList, secretariat: people, roles: roleList, key_dates: dateList, schedule: scheduleList, ...(again ? { status: "pending" } : {}) };
    const sent = edit ? supabase.from("conferences").update(changes).eq("id", edit.id) : null;
    const { data: saved, error } = sent
      ? await (stamp.current ? sent.eq("updated_at", stamp.current) : sent).select("id, updated_at")
      : await supabase.from("conferences").insert({
          ...fields, ...(guideList.length ? { guides: guideList } : {}), ...(people.length ? { secretariat: people } : {}), ...(roleList.length ? { roles: roleList } : {}), ...(dateList.length ? { key_dates: dateList } : {}), ...(scheduleList.length ? { schedule: scheduleList } : {}),
          submitted_by: session.user.id,
        }).select("id, updated_at");
    if (!error && !saved?.length && edit) {
      // Nothing was updated. Read the listing again to say which of the reasons it is; what was typed stays in the form.
      const why = await whyNotSaved(edit.id);
      setBusy(false);
      setConflict(why.conflict);
      return setErrors({ form: why.text });
    }
    setBusy(false);
    if (!error && !saved?.length) return setErrors({ form: "You can’t edit this listing any more. Ask the person who listed it." });
    if (error) return setErrors({ form: error.message.startsWith("Too many listings") ? "You’ve sent 5 listings today. Try again tomorrow." : again && error.code === "42501" ? "This listing can’t be sent for review again yet." : "Couldn’t send it. Check your connection and try again." });
    if (edit) {
      stamp.current = (saved?.[0] as { updated_at?: string } | undefined)?.updated_at ?? stamp.current;
      // What was just saved is the new starting point, so the next save doesn't see the same rename or removal again.
      const sentNames = new Map(sentRows.map((r) => [r.key, r.name.trim()]));
      setCommittees((cur) => cur.map((r) => (sentNames.has(r.key) ? { ...r, was: sentNames.get(r.key) || undefined } : r)));
      setEditing((cur) => (cur && typeof cur === "object" ? ({ ...cur, committees: changes.committees } as Editing) : cur));
    }
    // Allocations follow a renamed committee when the person asked for that.
    if (edit && also && !(await moveAllocations(edit.id, also.moves))) say.current("Saved, but the allocations weren’t moved. Fix them in Applications.");
    if (edits.current === seen) setDirty(false);
    if (edit) {
      forgetListing(edit.id);
      // New links or guides on a live listing queue emails to its followers; this sends them.
      supabase.functions.invoke("notify").catch(() => {});
      // In its workspace the form stays as it is: the listing is read again and a live one's page shows the edit straight away.
      if (listing) {
        listing.say(again ? "Sent for review again." : edit.status === "published" ? "Saved. It shows on the live page now." : "Saved. It goes with the review.");
        // A listing sent again is now in review: the form reads it over so it says so.
        if (again) void reloadForm();
        listing.changed();
        return;
      }
      if (edit.status === "published") refreshSite().then(() => router.refresh());
    }
    // The form is gone once it is sent, so whatever was typed meanwhile went with it.
    setDirty(false);
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

  const field = (f: F) => {
          const id = `f-${f.name}`;
          const err = errors[f.name];
          const hintId = err ? `${id}-err` : f.hint ? `${id}-hint` : undefined;
          const clear = () => err && setErrors(({ [f.name]: _, ...rest }) => rest);
          return (
            <Fragment key={f.name}>
            <div className={`field ${f.wide ? s.wide : ""} ${err ? s.invalid : ""}`}>
              <label htmlFor={id} className={f.name === "overview" ? "sr-only" : undefined}>{f.label}{f.required ? <span className={s.req} aria-hidden="true"> *</span> : <span className="muted"> (optional)</span>}</label>
              {f.type === "select" ? (
                <Select id={id} name={f.name} className="control" defaultValue={edit?.level ?? ""} onChange={() => { clear(); touch(); }}>
                  <option value="">Not sure yet</option>
                  {f.options!.map((o) => <option key={o}>{o}</option>)}
                </Select>
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
                  defaultValue={edit ? (OPENS[f.name] ? isoToSydney(asText(edit, OPENS[f.name])) : asText(edit, f.name)) : f.name === "contact" ? session?.user.email : undefined}
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
            {f.name === "end_date" && firstDay && firstDay < todayInSydney() && <small className="muted">The first day has already passed. That’s fine if you’re adding a conference that’s been run.</small>}
            </Fragment>
          );
  };

  // Any field typed in or changed. A photo picker is left to the photo, which counts only a photo it accepts.
  const changed = (e: React.FormEvent<HTMLFormElement>) => {
    if (e.target instanceof HTMLInputElement && e.target.type === "file") return;
    touch();
  };

  const form = (
    <form key={`${edit?.id ?? "form"}-${rev}`} ref={formEl} className={s.listForm} onSubmit={submit} onInput={changed} onChange={changed} noValidate>
      <Section id="sec-details" title="Details">
        <div className={s.formGrid}>{FIELDS.filter((f) => f.name !== "overview").map(field)}</div>
      </Section>
      <Section id="sec-overview" title="Overview">
        {FIELDS.filter((f) => f.name === "overview").map(field)}
      </Section>
      <Section id="sec-keydates" title="Key dates">
        <fieldset className="field">
          <legend className="sr-only">Key dates</legend>
          <KeyDatesEditor rows={keyDates} setRows={(a) => { touch(); setKeyDates(a); }} />
        </fieldset>
      </Section>
      <Section id="sec-schedule" title="Schedule">
        <fieldset className="field">
          <legend className="sr-only">Schedule</legend>
          <small className="muted">Times are Sydney time.</small>
          <ScheduleEditor rows={schedule} setRows={(a) => { touch(); setSchedule(a); }} first={firstDay} last={lastDay} />
        </fieldset>
      </Section>
      <Section id="sec-committees" title="Committees">
        <fieldset className="field">
          <legend className="sr-only">Committees</legend>
          {errors.committees && <small key="err" className={`t-reveal ${s.error}`}>{errors.committees}</small>}
          {errors.guides && <small key="gerr" className={`t-reveal ${s.error}`}>{errors.guides}</small>}
          <CommitteesEditor rows={committees} setRows={(a) => { touch(); setCommittees(a); setWarn(null); if (errors.guides || errors.committees) setErrors(({ guides: _, committees: __, ...rest }) => rest); }} upload={uploadGuide} />
        </fieldset>
      </Section>
      <Section id="sec-secretariat" title="Secretariat">
        <fieldset className="field">
          <legend className="sr-only">Secretariat</legend>
          <SecretariatEditor rows={secretariat} setRows={(a) => { touch(); setSecretariat(a); }} upload={(file) => uploadPhoto(file, session!.user.id)} />
        </fieldset>
      </Section>
      <Section id="sec-photos" title="Photos">
        <PhotoField id="cover" label="Cover photo" frame="On its page" ratio={3} ph={coverPhoto} error={errors.cover} />
        <PhotoField id="thumb" label="Photo in the lists" frame="In the lists" ratio={1} ph={thumbPhoto} error={errors.thumb}
          hint={coverPhoto.shown ? "Leave empty to use the cover photo." : undefined} />
      </Section>
      {/* In a listing's Edit tab this card stays at the foot of the screen while the form scrolls, so saving is always in reach. */}
      <div className={edit ? lf.bar : `panel ${card.card}`}>
        <div className={`field ${edit ? lf.barInner : ""}`}>
          {/* Agreed when the listing was first sent, so not asked again on every edit. */}
          {!edit && (
            <label className={`check ${errors.publish ? "invalid" : ""}`} style={{ marginBottom: 8 }}>
              <input type="checkbox" name="publish" aria-invalid={Boolean(errors.publish)} aria-describedby={errors.publish ? "publish-err" : undefined} onChange={() => errors.publish && setErrors(({ publish: _, ...rest }) => rest)} />
              <span>I help run this conference or have its organisers&rsquo; permission, and I agree these details, including the contact email, will be public once approved. See the <Link href="/terms" target="_blank">Terms of use</Link>.</span>
            </label>
          )}
          {!edit && errors.publish && <p key="publish" id="publish-err" className={`t-reveal ${s.error}`}>{errors.publish}</p>}
          {warn && (
            <div className={`${s.error} t-reveal`} role="alert" style={{ marginBottom: 8 }}>
              <p>
                {warn.renames.length > 0 && <>Renaming {warn.renames.map((r) => `${r.from} to ${r.to}`).join(", ")}. </>}
                {warn.removed.length > 0 && <>Removing {warn.removed.join(", ")}. </>}
                {warn.moves.length + warn.orphaned > 0 && <>{warn.moves.length + warn.orphaned} {warn.moves.length + warn.orphaned === 1 ? "person is" : "people are"} already placed in {warn.moves.length ? "a renamed or removed committee" : "a removed committee"}. </>}
                {warn.choices > 0 && <>{warn.choices} {warn.choices === 1 ? "applicant chose" : "applicants chose"} a committee that changes, and their choice stays as they wrote it. </>}
                {warn.moves.length > 0 && <>Also Update Allocations moves the people in a renamed committee to its new name. Anyone already sent their allocation gets it once more, with the new name, the next time you send allocations.</>}
              </p>
              <div className="actions">
                {warn.moves.length > 0 && <button type="button" className="button" onClick={() => { confirmed.current = "alloc"; formEl.current?.requestSubmit(); }}>Also Update Allocations</button>}
                <button type="button" className="button" onClick={() => { confirmed.current = "plain"; formEl.current?.requestSubmit(); }}>Save Anyway</button>
                <button type="button" className="button" onClick={() => setWarn(null)}>Cancel</button>
              </div>
            </div>
          )}
          {errors.form && <p key={errors.form} className={`t-reveal ${s.error} ${edit ? lf.barError : ""}`}>{errors.form}</p>}
          {conflict && <button type="button" className="button block" onClick={() => void reloadForm()}>Reload Listing</button>}
          {edit && <span className={lf.status} role="status">{dirty ? "Unsaved changes" : ""}</span>}
          <button type="submit" className={`button lg ${edit ? lf.save : auth.submit}`} disabled={busy}>
            <span key={String(busy)} className="t-swap">{edit ? (busy ? "Saving…" : again ? "Send for Review Again" : "Update") : busy ? "Sending…" : "Send for Review"}</span>
          </button>
          {!edit && (
            <small className="muted" style={{ textAlign: "center" }}>
              <span className={s.req} aria-hidden="true">*</span> is required <span aria-hidden="true">&middot;</span> The Collex team will review it before it goes live
            </small>
          )}
        </div>
      </div>
    </form>
  );

  // In a listing's workspace: only the form, which the workspace frames.
  if (listing) {
    if (editing === null) return <div className="skelWrap"><FormSkeleton fields={6} width={600} grid /></div>;
    if (!edit) return <div className={board.empty}><Placard /><p className={board.emptyTitle}>This listing can&rsquo;t be edited</p><p className="muted">Only the people who run it can change it.</p></div>;
    return form;
  }

  // On its own, for a new listing: the headline band above every state of the page.
  const band: BandProps = { title: "List a", accent: "conference" };
  const page = (top: BandProps, body: React.ReactNode) => (
    <>
      <PageBand {...top} />
      <div className={auth.body}>{body}</div>
    </>
  );
  // The whole loading state waits a beat before showing, so a session that arrives quickly replaces it unseen.
  if (!ready) return <div className="skelWrap">{page(band, <FormSkeleton fields={6} width={600} grid />)}</div>;
  if (!session) {
    return page({
      ...band, lead: "Log in first. Your listing stays tied to your account, so you can track it.",
      aside: (
        <div className="btnStack">
          <Link href="/login" className="button lg">Log In</Link>
          <Link href="/signup" className="button secondary lg">Create an Account</Link>
        </div>
      ),
    }, null);
  }
  if (sent) {
    return page({
      title: "Sent for", accent: "review",
      media: <svg width="56" height="56" viewBox="0 0 40 40" aria-hidden="true" className={s.sentIcon}><circle cx="20" cy="20" r="19" fill="var(--accent-soft)" /><path d="M13 20.5l5 5 9-10" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} /></svg>,
    },
      <div key="sent" role="status" className={`t-reveal ${auth.sent}`}>
        <ol className={`t-stagger ${s.next}`}>
          {["The Collex team reviews it.", "Once approved, it gets its own page and joins the calendar.", "Its status shows on Your conferences the whole time."].map((line, i) => (
            <li key={line} style={{ "--i": i } as React.CSSProperties}>{line}</li>
          ))}
        </ol>
        <div className="btnStack one">
          <Link href="/listings" className="button lg">See Its Status</Link>
          <button className="button secondary lg" onClick={() => { setSent(false); setCommittees([]); setStray([]); setSecretariat(secretariatRows()); setRoles([]); setKeyDates(keyDateRows()); setSchedule([]); }}>List another</button>
        </div>
      </div>);
  }
  return (
    <>
      <PageBand {...band} />
      <Work sections={FORM_SECTIONS}>{form}</Work>
      {toast.node}
    </>
  );
}

/** Live listings running on any day from first to last, except the one being edited. */
function clashing(list: ConferenceSummary[], first: string, last: string, except?: string) {
  return list.filter((c) => c.id !== except && c.startDate && c.startDate <= last && (c.endDate ?? c.startDate) >= first);
}

// Polite, not blocking: it names the clash so the organiser can decide. Always in the page, so screen readers hear it appear.
function ClashNote({ clashes }: { clashes: ConferenceSummary[] }) {
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
