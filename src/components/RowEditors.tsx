"use client";

import type { Dispatch, SetStateAction } from "react";
import { flushSync } from "react-dom";
import { NA, ROLE_KINDS, webUrl, type Committee, type Conference, type Role, type RoleKind } from "@/lib/conferences";
import IconButton, { ICONS } from "./IconButton";
import s from "@/app/inner.module.css";

// Row-by-row editors for a listing's committees, secretariat and roles needed: add, remove and reorder, each row a set of labelled fields,
// including that committee's background guide (a link, or a PDF uploaded to Collex).
// Works by keyboard (focus follows a moved row) and by touch.

/** The guide fields are only used while editing: the page saves them into the listing's guides, by committee name. */
export type CommitteeRow = Committee & {
  key: string; guide: string; released: string;
  /** The file's name after a PDF upload, so the row can say what's attached. */
  fileName?: string; uploading?: boolean; guideError?: string;
};

const key = () => crypto.randomUUID();
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const blank = (v: string) => (v === NA ? "" : v);
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });

/** The rows for a listing's committees, each with the guide listed under its name (if any). */
export const committeeRows = (list: Committee[], guides: Conference["guides"] = []): CommitteeRow[] =>
  list.map((c) => {
    const g = guides.find((x) => x.committee === c.name && x.url);
    return { name: c.name, topic: blank(c.topic), level: blank(c.level), chairs: blank(c.chairs), guide: g?.url ?? "", released: g?.released ?? "", key: key() };
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
/** A guide link that isn't a plain web address. */
export const badGuide = (r: CommitteeRow) => r.guide.trim() !== "" && !webUrl(r.guide);

function move<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// The add / reorder / remove frame around the rows.
function Rows<T extends { key: string }>({ id, rows, setRows, label, addLabel, make, render, max, inline }: {
  id: string; rows: T[]; setRows: Dispatch<SetStateAction<T[]>>; label: (r: T, i: number) => string;
  addLabel: string; make: () => T; max?: number;
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
    </div>
  );
}

/** Puts a chosen PDF on Collex and gives back its address, or says what went wrong. */
export type UploadGuide = (file: File) => Promise<{ url: string } | { error: string }>;

export function CommitteesEditor({ rows, setRows, upload }: { rows: CommitteeRow[]; setRows: Dispatch<SetStateAction<CommitteeRow[]>>; upload: UploadGuide }) {
  return (
    <Rows<CommitteeRow>
      id="committee" rows={rows} setRows={setRows} addLabel="Add a committee"
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
          <label className={s.editWide}><span>Committee</span><input id={`committee-${i}-first`} className="control" value={r.name} maxLength={120} placeholder="For example, UNSC" onChange={(e) => set({ name: e.target.value })} /></label>
          <label className={s.editWide}><span>Topic</span><input className="control" value={r.topic} maxLength={300} placeholder="For example, Arctic sovereignty" onChange={(e) => set({ topic: e.target.value })} /></label>
          <label>
            <span>Level</span>
            <select className="control" value={r.level} onChange={(e) => set({ level: e.target.value })}>
              <option value="">Not set</option>
              {/* A level typed on an older listing stays choosable until it's changed. */}
              {[...LEVELS, ...(r.level && !LEVELS.includes(r.level) ? [r.level] : [])].map((o) => <option key={o}>{o}</option>)}
            </select>
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

export type SecretariatRow = { role: string; name: string; key: string };
const STANDARD_ROLES = ["Secretary-General", "Deputy Secretary-General", "Director-General", "Head of Chairs"];

/** The usual four roles, in order, with whatever names are saved; any other saved roles follow. */
export const secretariatRows = (list: { role: string; name: string }[] = []): SecretariatRow[] => {
  const named = list.filter((p) => p.role && p.name && p.name !== NA);
  return [
    ...STANDARD_ROLES.map((role) => ({ role, name: named.find((p) => p.role === role)?.name ?? "", key: key() })),
    ...named.filter((p) => !STANDARD_ROLES.includes(p.role)).map((p) => ({ role: p.role, name: p.name, key: key() })),
  ];
};
/** Only people with both a role and a name are kept; the page shows N/A for what's missing. */
export const toSecretariat = (rows: SecretariatRow[]) =>
  rows.filter((r) => r.role.trim() && r.name.trim()).map((r) => ({ role: r.role.trim(), name: r.name.trim() }));

export function SecretariatEditor({ rows, setRows }: { rows: SecretariatRow[]; setRows: Dispatch<SetStateAction<SecretariatRow[]>> }) {
  return (
    <>
      <datalist id="secretariat-roles">{STANDARD_ROLES.map((r) => <option key={r} value={r} />)}</datalist>
      <Rows<SecretariatRow>
        id="secretariat" rows={rows} setRows={setRows} addLabel="Add a person" max={20} inline
        label={(r, i) => r.role.trim() || `person ${i + 1}`}
        make={() => ({ role: "", name: "", key: key() })}
        render={(r, i, set) => <>
          <label><span>Role</span><input id={`secretariat-${i}-first`} className="control" list="secretariat-roles" value={r.role} maxLength={80} placeholder="For example, Secretary-General" onChange={(e) => set({ role: e.target.value })} /></label>
          <label><span>Name</span><input className="control" value={r.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} /></label>
        </>}
      />
    </>
  );
}

// ---- Roles needed: help the conference is looking for ----

export type RoleRow = { kind: RoleKind; title: string; note: string; url: string; key: string };
export const roleRows = (list: Partial<Role>[] | null | undefined): RoleRow[] =>
  (list ?? []).filter((r) => ROLE_KINDS.some((k) => k.id === r.kind))
    .map((r) => ({ kind: r.kind!, title: r.title ?? "", note: r.note ?? "", url: r.url ?? "", key: key() }));
export const toRoles = (rows: RoleRow[]): Role[] => rows.map((r) => ({ kind: r.kind, title: r.title.trim(), note: r.note.trim(), url: r.url.trim() || null }));
/** An apply link that isn't a plain web address. */
export const badRole = (r: RoleRow) => r.url.trim() !== "" && !webUrl(r.url);

export function RolesEditor({ rows, setRows }: { rows: RoleRow[]; setRows: Dispatch<SetStateAction<RoleRow[]>> }) {
  return (
    <Rows<RoleRow>
      id="role" rows={rows} setRows={setRows} addLabel="Add a role" max={12}
      label={(r, i) => r.title.trim() || ROLE_KINDS.find((k) => k.id === r.kind)?.label || `role ${i + 1}`}
      make={() => ({ kind: "chair", title: "", note: "", url: "", key: key() })}
      render={(r, i, set) => {
        const bad = badRole(r);
        return <>
          <label>
            <span>Kind of help</span>
            <select id={`role-${i}-first`} className="control" value={r.kind} onChange={(e) => set({ kind: e.target.value as RoleKind })}>
              {ROLE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </label>
          <label><span>Title</span><input className="control" value={r.title} maxLength={80} placeholder="For example, Head chair" onChange={(e) => set({ title: e.target.value })} /></label>
          <label className={s.editWide}><span>What you need</span><textarea className="control" value={r.note} maxLength={400} rows={3} onChange={(e) => set({ note: e.target.value })} /></label>
          <label className={`${s.editWide} ${bad ? s.invalid : ""}`}>
            <span>Apply link</span>
            <input id={`role-${i}-url`} className="control" type="url" value={r.url} maxLength={500} placeholder="Leave blank to be contacted by email" aria-invalid={bad} onChange={(e) => set({ url: e.target.value })} />
            {bad && <small className={s.error}>Use a full link starting with https://</small>}
          </label>
        </>;
      }}
    />
  );
}

// ---- Key dates: registration opens, papers due, conference day ----

export type KeyDateRow = { label: string; date: string; key: string };
const STANDARD_DATES = ["Delegation registration opens", "Chair applications close", "Country allocations sent", "Background guides released", "Position papers due", "Conference day"];

/** The usual milestones in order, with whatever dates are saved; any other saved dates follow. */
export const keyDateRows = (list: { label: string; date: string | null }[] = []): KeyDateRow[] => [
  ...STANDARD_DATES.map((label) => ({ label, date: list.find((k) => k.label === label)?.date ?? "", key: key() })),
  ...list.filter((k) => !STANDARD_DATES.includes(k.label)).map((k) => ({ label: k.label, date: k.date ?? "", key: key() })),
];
/** Only dates that are filled in are kept; the page lists what's announced and leaves out the rest. */
export const toKeyDates = (rows: KeyDateRow[]) => rows.filter((r) => r.label.trim() && r.date).map((r) => ({ label: r.label.trim(), date: r.date }));

export function KeyDatesEditor({ rows, setRows }: { rows: KeyDateRow[]; setRows: Dispatch<SetStateAction<KeyDateRow[]>> }) {
  return (
    <Rows<KeyDateRow>
      id="keydate" rows={rows} setRows={setRows} addLabel="Add a date" max={20} inline
      label={(r, i) => r.label.trim() || `date ${i + 1}`}
      make={() => ({ label: "", date: "", key: key() })}
      render={(r, i, set) => <>
        <label><span>What</span><input id={`keydate-${i}-first`} className="control" value={r.label} maxLength={80} placeholder="For example, Position papers due" onChange={(e) => set({ label: e.target.value })} /></label>
        <label><span>When</span><input className="control" type="date" value={r.date} onChange={(e) => set({ date: e.target.value })} /></label>
      </>}
    />
  );
}
