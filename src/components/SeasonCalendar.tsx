"use client";

import Link from "next/link";
import { useState } from "react";
import { conferences, inMonth, MONTHS, SEASON_YEAR } from "@/lib/conferences";
import ConferenceRow from "./ConferenceRow";
import board from "./board.module.css";
import s from "@/app/inner.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const isoOf = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function SeasonCalendar() {
  const [month, setMonth] = useState(2); // March: the season usually starts here
  const year = SEASON_YEAR;
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Monday first
  const days = new Date(year, month + 1, 0).getDate();
  const todayIso = new Date().toISOString().slice(0, 10);
  const listed = inMonth(month);
  const onDay = (iso: string) =>
    conferences.filter((c) => c.startDate && c.startDate <= iso && (c.endDate ?? c.startDate) >= iso);

  return (
    <>
      <div className={s.monthStrip} role="group" aria-label="Jump to month">
        {MONTHS.map((m, i) => (
          <button key={m} aria-pressed={i === month} onClick={() => setMonth(i)}>
            {m.slice(0, 3)} <small className="num">{inMonth(i).length || "N/A"}</small>
          </button>
        ))}
      </div>

      <div className={s.calBar}>
        <h2 className={s.monthName} aria-live="polite">{MONTHS[month]} {year}</h2>
        <div className={s.calNav}>
          <button className="button secondary" onClick={() => setMonth((m) => Math.max(0, m - 1))} disabled={month === 0} aria-label="Previous month">‹</button>
          <button className="button secondary" onClick={() => setMonth((m) => Math.min(11, m + 1))} disabled={month === 11} aria-label="Next month">›</button>
        </div>
      </div>

      <div className={s.calGrid}>
        <div className={s.weekdays} aria-hidden="true">
          {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className={s.days} role="grid" aria-label={`${MONTHS[month]} ${year}`}>
          {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} className={`${s.day} ${s.blank}`} aria-hidden="true" />)}
          {Array.from({ length: days }, (_, i) => {
            const iso = isoOf(year, month, i + 1);
            const dow = (lead + i) % 7;
            return (
              <div key={iso} role="gridcell" className={`${s.day} ${dow >= 5 ? s.weekend : ""} ${iso === todayIso ? s.today : ""}`}>
                <span className={s.dayNum}>{i + 1}</span>
                {onDay(iso).map((c) => (
                  <Link key={c.slug} href={`/conferences/${c.slug}`} className={s.event}>{c.shortName}</Link>
                ))}
              </div>
            );
          })}
          {Array.from({ length: (7 - ((lead + days) % 7)) % 7 }, (_, i) => <div key={`t${i}`} className={`${s.day} ${s.blank}`} aria-hidden="true" />)}
        </div>
      </div>

      <section className={s.agenda} aria-labelledby="agenda-h">
        <h2 id="agenda-h" className={s.h2}>On in {MONTHS[month]}</h2>
        {listed.length === 0 ? (
          <div className={board.empty}>
            <p className={board.emptyTitle}>Nothing listed for {MONTHS[month]}</p>
            <p className="muted">Conferences listed for this month will appear here and on the grid above.</p>
            <Link href="/list" className="button secondary">List a conference</Link>
          </div>
        ) : (
          <div className={board.list}>{listed.map((c) => <ConferenceRow key={c.slug} c={c} />)}</div>
        )}
      </section>
    </>
  );
}
