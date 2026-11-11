"use client";

import s from "./MonthPicker.module.css";

/** ‹ [ 2027 ] ›  — the same pill as the month picker, stepping a whole year. */
export default function YearPicker({ year, onChange }: { year: number; onChange: (year: number, dir: "next" | "prev") => void }) {
  const chevron = (d: string) => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return (
    <div className={s.picker}>
      <span className="tip" data-tip="Previous year" data-tip-align="start">
        <button className={s.arrow} onClick={() => onChange(year - 1, "prev")} aria-label={`Previous year, ${year - 1}`}>{chevron("M10 3.5L5.5 8 10 12.5")}</button>
      </span>
      <span className={s.trigger} style={{ cursor: "default" }}><span key={year} className="t-swap">{year}</span></span>
      <span className="tip" data-tip="Next year">
        <button className={s.arrow} onClick={() => onChange(year + 1, "next")} aria-label={`Next year, ${year + 1}`}>{chevron("M6 3.5L10.5 8 6 12.5")}</button>
      </span>
    </div>
  );
}
