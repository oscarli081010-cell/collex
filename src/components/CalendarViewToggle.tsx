"use client";

import s from "./MonthPicker.module.css";

const CAL = <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>;
const GRID = <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1.2" /><rect x="9" y="2" width="5" height="5" rx="1.2" /><rect x="2" y="9" width="5" height="5" rx="1.2" /><rect x="9" y="9" width="5" height="5" rx="1.2" /></svg>;

/** Month | Year, in the same pill as the month and year steppers beside it. */
export default function CalendarViewToggle({ mode, onChange }: { mode: "month" | "year"; onChange: (m: "month" | "year") => void }) {
  const items = [{ id: "month" as const, label: "Month", icon: CAL }, { id: "year" as const, label: "Year", icon: GRID }];
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = mode === "month" ? "year" : "month";
    onChange(next);
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`#cal-tab-${next}`)?.focus();
  };
  return (
    <div className={s.picker} role="tablist" aria-label="Calendar view" onKeyDown={onKey}>
      {items.map((i) => (
        <button key={i.id} id={`cal-tab-${i.id}`} type="button" role="tab" aria-selected={mode === i.id} aria-controls={`cal-panel-${i.id}`} tabIndex={mode === i.id ? 0 : -1}
          className={`${s.trigger} ${s.viewBtn}`} onClick={() => onChange(i.id)}>
          <span className={s.viewIcon}>{i.icon}</span>{i.label}
        </button>
      ))}
    </div>
  );
}
