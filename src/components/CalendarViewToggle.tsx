"use client";

import s from "./MonthPicker.module.css";

/** Month | Year, in the same pill as the month and year steppers beside it. */
export default function CalendarViewToggle({ mode, onChange }: { mode: "month" | "year"; onChange: (m: "month" | "year") => void }) {
  const items = [{ id: "month" as const, label: "Month" }, { id: "year" as const, label: "Year" }];
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
          {i.label}
        </button>
      ))}
    </div>
  );
}
