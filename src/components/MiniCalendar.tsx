"use client";

import Link from "next/link";
import { useState } from "react";
import { clashesNear, conferences, SEASON_YEAR } from "@/lib/conferences";
import MonthPicker, { type YM } from "./MonthPicker";
import s from "./board.module.css";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Month calendar that doubles as the date-clash checker: pick a day, see what else is on that weekend.
export default function MiniCalendar() {
  const [view, setView] = useState<YM>({ y: SEASON_YEAR, m: 2 });
  const [dir, setDir] = useState<"next" | "prev">("next");
  const [picked, setPicked] = useState<string | null>(null);

  const lead = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const busy = (day: string) =>
    conferences.some((c) => c.startDate && c.startDate <= day && (c.endDate ?? c.startDate) >= day);

  const clashes = picked ? clashesNear(picked) : [];
  const pickedLabel = picked
    ? new Date(picked + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div className={`panel ${s.cal}`}>
      <h2 className={s.calTitle}>Check a date</h2>
      <p className={s.calHint}>Pick a day to see if another conference is on that weekend.</p>
      <div className={s.calHead}>
        <MonthPicker size="sm" value={view} onChange={(v, d) => { setDir(d); setView(v); }} />
      </div>
      <div className={s.calWeek} aria-hidden="true">{WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}</div>
      <div key={`${view.y}-${view.m}`} className={`t-slide ${s.calDays}`} data-dir={dir}>
        {Array.from({ length: 42 }, (_, i) => {
          const d = i - lead + 1;
          if (d < 1 || d > days) return <span key={i} className={s.calBlank} />;
          const day = iso(view.y, view.m, d);
          const on = picked === day;
          return (
            <button
              key={i}
              className={`${s.calDay} ${busy(day) ? s.calBusy : ""} ${i % 7 >= 5 ? s.calWeekend : ""}`}
              aria-pressed={on}
              aria-label={new Date(day + "T00:00:00").toDateString()}
              onClick={() => setPicked(on ? null : day)}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className={s.calResult} aria-live="polite">
        {!picked && <p key="none" className="t-reveal muted">No date picked yet.</p>}
        {picked && (
          <div key={picked} className="t-reveal">
            <p className={s.calResultHead}>
              <span className={clashes.length ? s.dotBusy : s.dotClear} aria-hidden="true" /> {pickedLabel}
            </p>
            {clashes.length === 0 ? (
              <p className="muted">Clear. Nothing listed that weekend.</p>
            ) : (
              <ul>
                {clashes.map((c) => <li key={c.slug}><Link className="link" href={`/conferences/${c.slug}`}>{c.name}</Link></li>)}
              </ul>
            )}
            <button className={s.calClear} onClick={() => setPicked(null)}>Clear selection</button>
          </div>
        )}
      </div>
    </div>
  );
}
