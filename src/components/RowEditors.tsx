"use client";

import type { Dispatch, SetStateAction } from "react";
import { flushSync } from "react-dom";
import { NA, ROLE_KINDS, scheduleOf, webUrl, type Committee, type Conference, type Role, type RoleKind, type ScheduleItem } from "@/lib/conferences";
import IconButton, { ICONS } from "./IconButton";
import s from "@/app/inner.module.css";
import Select from "./Select";

// Row-by-row editors for a listing's committees, secretariat and key dates: add, remove and reorder, each row a set of labelled fields,
// including that committee's background guide (a link, or a PDF uploaded to Collex).
// Works by keyboard (focus follows a moved row) and by touch.

/** The guide fields are only used while editing: the page saves them into the listing's guides, by committee name. */
export type CommitteeRow = Committee & {
  key: string; guide: string; released: string;
  /** The file's name after a PDF upload, so the row can say what's attached. */
  fileName?: string; uploading?: boolean; guideError?: string;
  /** The name this committee had when the listing was loaded, so a rename can be told from a new committee. */
  was?: string;
};

const key = () => crypto.randomUUID();
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const blank = (v: string) => (v === NA ? "" : v);
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });

/** The rows for a listing's committees, each with the guide listed under its name (if any). */
export const committeeRows = (list: Committee[], guides: Conference["guides"] = []): CommitteeRow[] =>
  list.map((c) => {
    const g = guides.find((x) => x.committee === c.name && x.url);
    return { name: c.name, topic: blank(c.topic), level: blank(c.level), chairs: blank(c.chairs), guide: g?.url ?? "", released: g?.released ?? "", key: key(), was: c.name };
  });

/** Guides whose committee is no longer in the list. They're kept as they were, not silently dropped. */
export const strayGuides = (list: Committee[], guides: Conference["guides"]) => guides.filter((g) => !list.some((c) => c.name === g.committee));

/** Back to what the listing stores: empty rows dropped, missing details as N/A. */
export const toCommittees = (rows: CommitteeRow[]): Committee[] =>
  rows.filter((r) => r.name.trim()).map((r) => ({
    name: r.name.trim(), topic: r.topic.trim() || NA, level: r.level.trim() || NA, chairs: r.chairs.trim() || NA,
  }));
/** A guide with a link is released (keeping the date it already had). */
export const toGuides = (rows: CommitteeRow[], stray: Conference["guides"] = []): Conference["guides"] => [
  ...rows.filter((r) => r.name.trim() && r.guide.trim()).map((r) => ({ committee: r.name.trim(), url: r.guide.trim(), released: r.released || todayIso() })),
  ...stray,
];
/** Two committees can't share a name, whatever the case or spacing: "unsc" and "UNSC " are the same one. */
const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
/** Whether this row repeats the name of an earlier one. */
export const repeatsCommittee = (rows: CommitteeRow[], i: number) => Boolean(rows[i].name.trim()) && rows.slice(0, i).some((r) => sameName(r.name, rows[i].name));
/** The first row that repeats an earlier committee's name, or -1. */
export const firstRepeat = (rows: CommitteeRow[]) => rows.findIndex((_, i) => repeatsCommittee(rows, i));
/** A guide link that isn't a plain web address. */
export const badGuide = (r: CommitteeRow) => r.guide.trim() !== "" && !webUrl(r.guide);

function move<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// The add / reorder / remove frame around the rows.
function Rows<T extends { key: string }>({ id, rows, setRows, label, addLabel, make, render, max, noun, inline }: {
  id: string; rows: T[]; setRows: Dispatch<SetStateAction<T[]>>; label: (r: T, i: number) => string;
  addLabel: string; make: () => T; max?: number;
  /** What the rows are called in "12 of 60 committees". */
  noun?: string;
  /** Rows that are a single line of fields: the buttons sit beside the inputs instead of in a tall column. */
  inline?: boolean; render: (r: T, i: number, set: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  const shift = (i: number, by: number, button: "up" | "down") => {
    // Render the move straight away, then keep focus on the same button of the row that moved,
    // so it can be moved again by keyboard.
    flushSync(() => setRows(move(rows, i, i + by)));
    const target = document.getElementById(`${id}-${i + by}-${button}`) as HTMLButtonElement | null;
    (target && !target.disabled ? target : document.getElementById(`${id}-${i + by}-${button === "up" ? "down" : "up"}`))?.focus();
  };
  const add = () => {
    flushSync(() => setRows([...rows, make()]));
    document.getElementById(`${id}-${rows.length}-first`)?.focus();
  };
  return (
    <div className={s.rowsEditor}>
      <ol className={s.rowsList}>
        {rows.map((r, i) => (
          <li key={r.key} className={`t-reveal ${s.editRow} ${inline ? s.editRowInline : ""}`}>
            {/* By the row's key, not its place or the list as it was when a slow upload started, so a late result can't undo other edits. */}
            <div className={s.editFields}>{render(r, i, (patch) => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, ...patch } : x))))}</div>
            <div className={s.editActions}>
              <IconButton id={`${id}-${i}-up`} label={`Move ${label(r, i)} up`} tip="Move up" icon={ICONS.up} disabled={i === 0} onClick={() => shift(i, -1, "up")} />
              <IconButton id={`${id}-${i}-down`} label={`Move ${label(r, i)} down`} tip="Move down" icon={ICONS.down} disabled={i === rows.length - 1} onClick={() => shift(i, 1, "down")} />
              <IconButton label={`Remove ${label(r, i)}`} tip="Remove" icon={ICONS.trash} danger onClick={() => {
                flushSync(() => setRows(rows.filter((_, j) => j !== i)));
                document.getElementById(`${id}-add`)?.focus();
              }} />
            </div>
          </li>
        ))}
      </ol>
      <button type="button" id={`${id}-add`} className={`button secondary ${s.addRow}`} onClick={add} disabled={max !== undefined && rows.length >= max}>+ {addLabel}</button>
      {max !== undefined && noun && <small className="muted" aria-live="polite">{rows.length} of {max} {noun}</small>}
    </div>
  );
}

/** Puts a chosen PDF on Collex and gives back its address, or says what went wrong. */
export type UploadGuide = (file: File) => Promise<{ url: string } | { error: string }>;

export function CommitteesEditor({ rows, setRows, upload }: { rows: CommitteeRow[]; setRows: Dispatch<SetStateAction<CommitteeRow[]>>; upload: UploadGuide }) {
  return (
    <Rows<CommitteeRow>
      id="committee" rows={rows} setRows={setRows} addLabel="Add a Committee" max={60} noun="committees"
      label={(r, i) => r.name.trim() || `committee ${i + 1}`}
      make={() => ({ name: "", topic: "", level: "", chairs: "", guide: "", released: "", key: key() })}
      render={(r, i, set) => {
        const bad = badGuide(r);
        const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          set({ uploading: true, guideError: undefined });
          const res = await upload(file);
          if ("error" in res) return set({ uploading: false, guideError: res.error });
          set({ uploading: false, guide: res.url, fileName: file.name, released: r.released || todayIso() });
        };
        return <>
          <label className={`${s.editWide} ${repeatsCommittee(rows, i) ? s.invalid : ""}`}>
            <span>Committee</span>
            <input id={`committee-${i}-first`} className="control" value={r.name} maxLength={120} placeholder="For example, UNSC" aria-invalid={repeatsCommittee(rows, i)} onChange={(e) => set({ name: e.target.value })} />
            {repeatsCommittee(rows, i) && <small className={s.error} role="alert">Another committee already has this name.</small>}
          </label>
          <label className={s.editWide}><span>Topic</span><input className="control" value={r.topic} maxLength={300} placeholder="For example, Arctic sovereignty" onChange={(e) => set({ topic: e.target.value })} /></label>
          <label>
            <span>Level</span>
            <Select className="control" value={r.level} onChange={(e) => set({ level: e.target.value })}>
              <option value="">Not set</option>
              {/* A level typed on an older listing stays choosable until it's changed. */}
              {[...LEVELS, ...(r.level && !LEVELS.includes(r.level) ? [r.level] : [])].map((o) => <option key={o}>{o}</option>)}
            </Select>
          </label>
          <label><span>Chairs</span><input className="control" value={r.chairs} maxLength={200} placeholder="Names, once announced" onChange={(e) => set({ chairs: e.target.value })} /></label>
          <div className={`${s.editWide} ${s.guideField} ${bad ? s.invalid : ""}`}>
            <label htmlFor={`committee-${i}-guide`}>Background guide</label>
            <div className={s.guideRow}>
              <input
                id={`committee-${i}-guide`} className="control" type="url" value={r.guide} maxLength={500} placeholder="Paste a link, or upload a PDF"
                aria-invalid={bad} aria-describedby={`committee-${i}-guide-note`}
                onChange={(e) => set({ guide: e.target.value, fileName: undefined, guideError: undefined, released: r.released || (e.target.value.trim() ? todayIso() : "") })}
              />
              <label className={`button secondary ${s.uploadBtn}`} data-busy={r.uploading || undefined}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 11V3M4.5 6.5L8 3l3.5 3.5M3 13.5h10" /></svg>
                {r.uploading ? "Uploading…" : "Upload PDF"}
                <input type="file" accept="application/pdf" className="sr-only" disabled={r.uploading} onChange={pick} />
              </label>
            </div>
            <small id={`committee-${i}-guide-note`} className={bad || r.guideError ? s.error : undefined} role={r.guideError ? "alert" : undefined}>
              {bad ? "Use a full link starting with https://" : r.guideError ?? (r.fileName && r.guide ? `${r.fileName} is attached.` : "")}
            </small>
          </div>
        </>;
      }}
    />
  );
}

// ---- Secretariat: who runs the conference ----

export type SecretariatRow = { role: string; name: string; key: string; /** A suggested role shown in grey until one is typed; it is used if only a name is given. */ hint?: string; photo?: string; uploading?: boolean; photoError?: string };
const STANDARD_ROLES = ["Secretary-General", "Deputy Secretary-General", "Director-General", "Head of Chairs"];

/** A new listing (or one with nobody saved yet) starts with the usual four roles as grey hints. Once people are saved, only they show, so a role that was removed stays removed. */
export const secretariatRows = (list: { role: string; name: string; photo?: string }[] = []): SecretariatRow[] => {
  const named = list.filter((p) => p.role && p.name && p.name !== NA);
  if (named.length) return named.map((p) => ({ role: p.role, name: p.name, photo: p.photo, key: key() }));
  return STANDARD_ROLES.map((hint) => ({ role: "", hint, name: "", key: key() }));
};
/** Only people with a name are kept; a row with no role typed takes its grey hint as the role. */
export const toSecretariat = (rows: SecretariatRow[]) =>
  rows.map((r) => ({ ...r, role: r.role.trim() || r.hint || "" })).filter((r) => r.role && r.name.trim())
    .map((r) => ({ role: r.role, name: r.name.trim(), ...(r.photo ? { photo: r.photo } : {}) }));

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export function SecretariatEditor({ rows, setRows, upload }: { rows: SecretariatRow[]; setRows: Dispatch<SetStateAction<SecretariatRow[]>>; upload: UploadGuide }) {
  const pick = async (key: string, file: File | undefined) => {
    if (!file) return;
    const patch = (p: Partial<SecretariatRow>) => setRows((all) => all.map((x) => (x.key === key ? { ...x, ...p } : x)));
    patch({ uploading: true, photoError: undefined });
    const res = await upload(file);
    patch("url" in res ? { uploading: false, photo: res.url } : { uploading: false, photoError: res.error });
  };
  return (
    <>
      <datalist id="secretariat-roles">{STANDARD_ROLES.map((r) => <option key={r} value={r} />)}</datalist>
      <Rows<SecretariatRow>
        id="secretariat" rows={rows} setRows={setRows} addLabel="Add a Person" max={20} noun="people" inline
        label={(r, i) => r.role.trim() || r.hint || `person ${i + 1}`}
        make={() => ({ role: "", name: "", key: key() })}
        render={(r, i, set) => <>
          <div className={s.photoField}>
            <label className={s.photoPick} data-busy={r.uploading || undefined} title={r.photoError}>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={r.uploading}
                aria-label={`${r.photo ? "Change" : "Add"} photo for ${r.name.trim() || r.role.trim() || `person ${i + 1}`}`}
                onChange={(e) => { pick(r.key, e.target.files?.[0]); e.target.value = ""; }} />
              {/* eslint-disable-next-line @next/next/no-img-element -- a small saved photo */}
              {r.photo ? <img src={r.photo} alt="" width={44} height={44} /> : initialsOf(r.name) || <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 6.5h2.2L6 4.5h6l1.3 2h2.2v7h-13z" /><circle cx="9" cy="9.8" r="2.4" /></svg>}
            </label>
            {r.photo && <button type="button" className={s.photoClear} aria-label={`Remove photo of ${r.name.trim() || r.role.trim() || "this person"}`} onClick={() => set({ photo: undefined })}>&times;</button>}
          </div>
          <label><span>Role</span><input id={`secretariat-${i}-first`} className="control" list="secretariat-roles" value={r.role} maxLength={80} placeholder={r.hint ?? "For example, Secretary-General"} onChange={(e) => set({ role: e.target.value })} /></label>
          <label><span>Name</span><input className="control" value={r.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} /></label>
          {r.photoError && <p role="alert" className={s.photoError}>{r.photoError}</p>}
        </>}
      />
    </>
  );
}

// ---- Roles already stored on a listing: no longer edited here, but passed through so saving does not wipe them ----

export type RoleRow = { kind: RoleKind; title: string; note: string; url: string; key: string };
export const roleRows = (list: Partial<Role>[] | null | undefined): RoleRow[] =>
  (list ?? []).filter((r) => ROLE_KINDS.some((k) => k.id === r.kind))
    .map((r) => ({ kind: r.kind!, title: r.title ?? "", note: r.note ?? "", url: r.url ?? "", key: key() }));
export const toRoles = (rows: RoleRow[]): Role[] => rows.map((r) => ({ kind: r.kind, title: r.title.trim(), note: r.note.trim(), url: r.url.trim() || null }));

// ---- Key dates: registration opens, papers due, conference day ----

export type KeyDateRow = { label: string; date: string; key: string; /** A suggested milestone shown in grey until one is typed; it is used if only a date is given. */ hint?: string };
const STANDARD_DATES = ["Delegation registration opens", "Chair applications close", "Country allocations sent", "Background guides released", "Position papers due", "Conference day"];

/** A new listing starts with the usual milestones in order. A saved one shows only what was saved, so a milestone that was removed stays removed. */
export const keyDateRows = (list?: { label: string; date: string | null }[]): KeyDateRow[] =>
  list ? list.map((k) => ({ label: k.label, date: k.date ?? "", key: key() }))
    : STANDARD_DATES.map((hint) => ({ label: "", hint, date: "", key: key() }));
/** Only dates that are filled in are kept; the page lists what's announced and leaves out the rest. */
export const toKeyDates = (rows: KeyDateRow[]) => rows.map((r) => ({ ...r, label: r.label.trim() || r.hint || "" })).filter((r) => r.label && r.date).map((r) => ({ label: r.label, date: r.date }));

export function KeyDatesEditor({ rows, setRows }: { rows: KeyDateRow[]; setRows: Dispatch<SetStateAction<KeyDateRow[]>> }) {
  return (
    <Rows<KeyDateRow>
      id="keydate" rows={rows} setRows={setRows} addLabel="Add a Date" max={20} noun="dates" inline
      label={(r, i) => r.label.trim() || r.hint || `date ${i + 1}`}
      make={() => ({ label: "", date: "", key: key() })}
      render={(r, i, set) => <>
        <label><span>What</span><input id={`keydate-${i}-first`} className="control" value={r.label} maxLength={80} placeholder={r.hint ?? "For example, Position papers due"} onChange={(e) => set({ label: e.target.value })} /></label>
        <label><span>When</span><input className="control" type="date" value={r.date} onChange={(e) => set({ date: e.target.value })} /></label>
      </>}
    />
  );
}

// ---- Schedule: what happens when on the day ----

export type ScheduleRow = { day: string; time: string; title: string; place: string; key: string };

/** The rows for a saved schedule; a missing or malformed one gives none. */
export const scheduleRows = (list: unknown): ScheduleRow[] =>
  scheduleOf(list).map((x) => ({ day: x.day ?? "", time: x.time, title: x.title, place: x.place, key: key() }));
/** Back to what the listing stores: a row with nothing under What is dropped, and one with no time keeps an empty time.
 *  A time field can give seconds ("09:00:00"), so only the hours and minutes are kept. Day is always written, null when empty. */
export const toSchedule = (rows: ScheduleRow[]): ScheduleItem[] =>
  rows.filter((r) => r.title.trim()).map((r) => {
    const time = r.time.slice(0, 5);
    return {
      day: /^\d{4}-\d{2}-\d{2}$/.test(r.day) ? r.day : null,
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "",
      title: r.title.trim(),
      place: r.place.trim(),
    };
  });

/** `first` and `last` are the conference's days, when known, so the date picker opens on them. */
export function ScheduleEditor({ rows, setRows, first, last }: { rows: ScheduleRow[]; setRows: Dispatch<SetStateAction<ScheduleRow[]>>; first?: string; last?: string }) {
  // A one-day conference may have no last day; the picker then keeps to its first.
  const max = (last && (!first || last >= first) ? last : first) || undefined;
  return (
    <Rows<ScheduleRow>
      id="schedule" rows={rows} setRows={setRows} addLabel="Add an Item" max={60} noun="items"
      label={(r, i) => r.title.trim() || `item ${i + 1}`}
      make={() => ({ day: "", time: "", title: "", place: "", key: key() })}
      render={(r, i, set) => <>
        <label><span>Day</span><input id={`schedule-${i}-first`} className="control" type="date" value={r.day} min={first || undefined} max={max} onChange={(e) => set({ day: e.target.value })} /></label>
        <label><span>Time</span><input className="control" type="time" value={r.time} onChange={(e) => set({ time: e.target.value })} /></label>
        <label><span>What</span><input className="control" value={r.title} maxLength={120} placeholder="For example, Opening ceremony" onChange={(e) => set({ title: e.target.value })} /></label>
        <label><span>Where</span><input className="control" value={r.place} maxLength={120} placeholder="For example, Great Hall" onChange={(e) => set({ place: e.target.value })} /></label>
      </>}
    />
  );
}
