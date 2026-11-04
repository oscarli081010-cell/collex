"use client";

import type { Dispatch, SetStateAction } from "react";
import { flushSync } from "react-dom";
import { NA, webUrl, type Committee, type Conference } from "@/lib/conferences";
import IconButton, { ICONS } from "./IconButton";
import s from "@/app/inner.module.css";

// A row-by-row editor for a listing's committees: add, remove and reorder, each row a set of labelled fields,
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
function Rows<T extends { key: string }>({ id, rows, setRows, label, addLabel, make, render }: {
  id: string; rows: T[]; setRows: Dispatch<SetStateAction<T[]>>; label: (r: T, i: number) => string;
  addLabel: string; make: () => T; render: (r: T, i: number, set: (patch: Partial<T>) => void) => React.ReactNode;
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
          <li key={r.key} className={`t-reveal ${s.editRow}`}>
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
      <button type="button" id={`${id}-add`} className={`button secondary ${s.addRow}`} onClick={add}>+ {addLabel}</button>
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
