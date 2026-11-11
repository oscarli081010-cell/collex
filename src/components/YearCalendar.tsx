"use client";

import { MONTHS, NA, formatRange, type Conference } from "@/lib/conferences";
import s from "@/app/inner.module.css";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const isoOf = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Every month of a year at once, drawn like the month calendar: Monday first, weekends shaded, today ringed, and a day with a conference
 * marked. Hover or focus on a marked day names what is on; selecting it opens the same card of conferences under the grid.
 */
export default function YearCalendar({ year, todayIso, onDay, picked, onPick, onOpenMonth }: {
  year: number; todayIso: string; onDay: (iso: string) => Conference[]; picked: string | null; onPick: (iso: string | null) => void; onOpenMonth: (m: number) => void;
}) {
  return (
    <div className={s.yearGrid}>
      {MONTHS.map((name, m) => {
        const lead = (new Date(year, m, 1).getDay() + 6) % 7;
        const days = new Date(year, m + 1, 0).getDate();
        let count = 0;
        for (let d = 1; d <= days; d++) if (onDay(isoOf(year, m, d)).length) count++;
        return (
          <section key={name} className={s.mini} aria-label={`${name} ${year}`}>
            <header className={s.miniHead}>
              <button type="button" className={s.miniName} onClick={() => onOpenMonth(m)} aria-label={`Open ${name} ${year}`}>{name}</button>
              {count > 0 && <span className={s.miniCount}>{count} {count === 1 ? "day" : "days"}</span>}
            </header>
            <div className={s.miniWeek} aria-hidden="true">{LETTERS.map((l, i) => <span key={i}>{l}</span>)}</div>
            <div className={s.miniDays} role="grid" aria-label={`${name} ${year}`}>
              {Array.from({ length: 42 }, (_, i) => {
                const d = i - lead + 1;
                if (d < 1 || d > days) return <span key={i} className={s.miniBlank} aria-hidden="true" />;
                const iso = isoOf(year, m, d);
                const on = onDay(iso);
                const cls = `${s.miniDay} ${i % 7 >= 5 ? s.weekend : ""} ${iso === todayIso ? s.today : ""} ${on.length ? s.busy : ""}`;
                if (!on.length) return <span key={i} role="gridcell" className={cls}>{d}</span>;
                return (
                  <span key={i} role="gridcell" className={`${cls} ${s.evWrap}`} data-edge={i % 7 >= 5 ? "end" : undefined}>
                    <button type="button" className={s.miniHit} aria-pressed={picked === iso} onClick={() => onPick(picked === iso ? null : iso)}
                      aria-label={`${d} ${name}: ${on.length} ${on.length === 1 ? "conference" : "conferences"}`}>{d}</button>
                    <span role="tooltip" className={s.preview}>
                      {on.map((c) => <span key={c.slug} className={s.previewName}>{c.shortName}</span>)}
                      <span>{formatRange(on[0])}{on.length > 1 ? ` and ${on.length - 1} more` : ""}</span>
                      <span className="muted">{on[0].host}{on[0].venue !== NA ? ` · ${on[0].venue}` : ""}</span>
                    </span>
                  </span>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
