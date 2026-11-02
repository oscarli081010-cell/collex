"use client";

import Link from "next/link";
import { useState } from "react";
import { clashesNear, conferences, MONTHS, SEASON_YEAR } from "@/lib/conferences";
import s from "./board.module.css";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Month calendar that doubles as the date-clash checker: pick a day, see what else is on that weekend.
export default function MiniCalendar() {
  const [view, setView] = useState({ y: SEASON_YEAR, m: 2 });
  const [picked, setPicked] = useState<string | null>(null);

  const first = new Date(view.y, view.m, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const busy = (day: string) =>
    conferences.some((c) => c.startDate && c.startDate <= day && (c.endDate ?? c.startDate) >= day);
  const shift = (n: number) =>
    setView(({ y, m }) => {
      const t = new Date(y, m + n, 1);
      return { y: t.getFullYear(), m: t.getMonth() };
    });

  const clashes = picked ? clashesNear(picked) : [];
  const pickedLabel = picked
    ? new Date(picked + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })
    : "";

  return (
    <div className={`panel ${s.cal}`}>
      <div className={s.calHead}>
        <h2 className={s.calTitle}>{MONTHS[view.m]} {view.y}</h2>
        <div className={s.calNav}>
          <button onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <button onClick={() => shift(1)} aria-label="Next month">›</button>
        </div>
      </div>
      <div className={s.calWeek} aria-hidden="true">{WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className={s.calDays}>
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const day = iso(view.y, view.m, i + 1);
          return (
            <button
              key={day}
              className={`${s.calDay} ${busy(day) ? s.calBusy : ""}`}
              aria-pressed={picked === day}
              aria-label={new Date(day + "T00:00:00").toDateString()}
              onClick={() => setPicked(day)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className={s.calResult} aria-live="polite">
        {!picked && <p className="muted">Pick a day to check it for clashes.</p>}
        {picked && clashes.length === 0 && (
          <>
            <p className={s.calResultHead}><span className={s.dotClear} aria-hidden="true" /> {pickedLabel}</p>
            <p className="muted">Clear. Nothing listed that weekend.</p>
          </>
        )}
        {picked && clashes.length > 0 && (
          <>
            <p className={s.calResultHead}><span className={s.dotBusy} aria-hidden="true" /> {pickedLabel}</p>
            <ul>
              {clashes.map((c) => <li key={c.slug}><Link className="link" href={`/conferences/${c.slug}`}>{c.name}</Link></li>)}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
