"use client";

import { flushSync } from "react-dom";
import { NA, type Committee, type Conference } from "@/lib/conferences";
import IconButton, { ICONS } from "./IconButton";
import s from "@/app/inner.module.css";

// Row-by-row editors for a listing's committees and background guides: add, remove and reorder,
// each row a set of labelled fields. Works by keyboard (focus follows a moved row) and by touch.

export type CommitteeRow = Committee & { key: string };
export type GuideRow = { committee: string; url: string; released: string; key: string };

const key = () => crypto.randomUUID();
const blank = (v: string) => (v === NA ? "" : v);
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });

export const committeeRows = (list: Committee[]): CommitteeRow[] =>
  list.map((c) => ({ name: c.name, topic: blank(c.topic), level: blank(c.level), chairs: blank(c.chairs), key: key() }));
export const guideRows = (list: Conference["guides"]): GuideRow[] =>
  list.map((g) => ({ committee: g.committee, url: g.url ?? "", released: g.released ?? "", key: key() }));

/** Back to what the listing stores: empty rows dropped, missing details as N/A. */
export const toCommittees = (rows: CommitteeRow[]): Committee[] =>
  rows.filter((r) => r.name.trim()).map((r) => ({
    name: r.name.trim(), topic: r.topic.trim() || NA, level: r.level.trim() || NA, chairs: r.chairs.trim() || NA,
  }));
/** A guide with a link is released (keeping the date it already had); one without a link is still to come. */
export const toGuides = (rows: GuideRow[]): Conference["guides"] =>
  rows.filter((r) => r.committee.trim() || r.url.trim()).map((r) => ({
    committee: r.committee.trim(), url: r.url.trim() || null, released: r.url.trim() ? r.released || todayIso() : null,
  }));

function move<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// The add / reorder / remove frame shared by both editors.
function Rows<T extends { key: string }>({ id, rows, setRows, label, addLabel, make, render }: {
  id: string; rows: T[]; setRows: (rows: T[]) => void; label: (r: T, i: number) => string;
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
            <div className={s.editFields}>{render(r, i, (patch) => setRows(rows.map((x, j) => (j === i ? { ...x, ...patch } : x))))}</div>
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

export function CommitteesEditor({ rows, setRows }: { rows: CommitteeRow[]; setRows: (r: CommitteeRow[]) => void }) {
  return (
    <Rows
      id="committee" rows={rows} setRows={setRows} addLabel="Add a committee"
      label={(r, i) => r.name.trim() || `committee ${i + 1}`}
      make={() => ({ name: "", topic: "", level: "", chairs: "", key: key() })}
      render={(r, i, set) => <>
        <label className={s.editWide}><span>Committee</span><input id={`committee-${i}-first`} className="control" value={r.name} maxLength={120} placeholder="For example, UNSC" onChange={(e) => set({ name: e.target.value })} /></label>
        <label className={s.editWide}><span>Topic</span><input className="control" value={r.topic} maxLength={300} placeholder="For example, Arctic sovereignty" onChange={(e) => set({ topic: e.target.value })} /></label>
        <label><span>Level</span><input className="control" value={r.level} maxLength={60} placeholder="For example, Intermediate" onChange={(e) => set({ level: e.target.value })} /></label>
        <label><span>Chairs</span><input className="control" value={r.chairs} maxLength={200} placeholder="Names, once announced" onChange={(e) => set({ chairs: e.target.value })} /></label>
      </>}
    />
  );
}

export function GuidesEditor({ rows, setRows, committees, error }: { rows: GuideRow[]; setRows: (r: GuideRow[]) => void; committees: string[]; error?: number[] }) {
  return (
    <Rows
      id="guide" rows={rows} setRows={setRows} addLabel="Add a guide"
      label={(r, i) => (r.committee.trim() ? `${r.committee} guide` : `guide ${i + 1}`)}
      make={() => ({ committee: committees[rows.length] ?? committees[0] ?? "", url: "", released: "", key: key() })}
      render={(r, i, set) => {
        // The committees above, plus this guide's own committee if it's no longer in that list.
        const options = [...new Set([...committees, r.committee].filter(Boolean))];
        const bad = error?.includes(i);
        return <>
          <label className={s.editWide}>
            <span>Committee</span>
            <select id={`guide-${i}-first`} className="control" value={r.committee} onChange={(e) => set({ committee: e.target.value })}>
              <option value="">Choose a committee</option>
              {options.map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <label className={`${s.editWide} ${bad ? s.invalid : ""}`}>
            <span>Link</span>
            <input className="control" type="url" value={r.url} maxLength={500} placeholder="https://… (leave empty until it's out)" aria-invalid={bad} onChange={(e) => set({ url: e.target.value, released: r.released || (e.target.value.trim() ? todayIso() : "") })} />
            {bad && <small className={s.error}>Use a full link starting with https://</small>}
          </label>
          <label className={s.editWide}>
            <span>Released</span>
            <input className="control" type="date" value={r.released} disabled={!r.url.trim()} onChange={(e) => set({ released: e.target.value })} />
          </label>
        </>;
      }}
    />
  );
}
