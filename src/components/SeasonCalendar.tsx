"use client";

import Link from "next/link";
import { useState } from "react";
import { conferences, inMonth, MONTHS, SEASON_YEAR, formatRange } from "@/lib/conferences";
import s from "@/app/inner.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isoOf(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function SeasonCalendar() {
  const [month, setMonth] = useState(2); // March: the season usually starts here
  const year = SEASON_YEAR;
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(year, month + 1, 0).getDate();
  const todayIso = new Date().toISOString().slice(0, 10);
  const listed = inMonth(month);

  const onDay = (iso: string) =>
    conferences.filter((c) => c.startDate && c.startDate <= iso && (c.endDate ?? c.startDate) >= iso);

  return (
    <>
      <div className={s.calBar}>
        <h2 className={`display ${s.monthName}`} aria-live="polite">{MONTHS[month]}</h2>
        <div className={s.calNav}>
          <button className="button ghost" onClick={() => setMonth((m) => Math.max(0, m - 1))} disabled={month === 0} aria-label="Previous month">←</button>
          <button className="button ghost" onClick={() => setMonth((m) => Math.min(11, m + 1))} disabled={month === 11} aria-label="Next month">→</button>
        </div>
      </div>

      <div className={s.weekdays} aria-hidden="true">
        {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className={s.days} role="grid" aria-label={`${MONTHS[month]} ${year}`}>
        {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} className={`${s.day} ${s.blank}`} aria-hidden="true" />)}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const iso = isoOf(year, month, d);
          const dow = (lead + i) % 7;
          const events = onDay(iso);
          return (
            <div
              key={iso}
              role="gridcell"
              className={`${s.day} ${dow >= 5 ? s.weekend : ""} ${iso === todayIso ? s.today : ""}`}
            >
              <span className={s.dayNum}>{d}</span>
              {events.map((c) => (
                <Link key={c.slug} href={`/conferences/${c.slug}`} className={s.event}>{c.shortName}</Link>
              ))}
            </div>
          );
        })}
      </div>

      <div className={s.monthStrip} role="group" aria-label="Jump to month">
        {MONTHS.map((m, i) => (
          <button key={m} aria-pressed={i === month} onClick={() => setMonth(i)}>
            <span>{m.slice(0, 3)}</span>
            <small className="num">{inMonth(i).length || "N/A"}</small>
          </button>
        ))}
      </div>

      <section className={s.agenda} aria-labelledby="agenda-h">
        <div>
          <h2 id="agenda-h" className={s.h2}>On in {MONTHS[month]}</h2>
          {listed.length === 0 ? (
            <div className={s.empty}>
              <p>
                Nothing listed for {MONTHS[month]} {year} yet. When a secretariat lists its conference, it
                shows here with its dates, host school and a link to its page.
              </p>
              <Link href="/list" className="button">List a conference <span className="arrow" aria-hidden="true">→</span></Link>
            </div>
          ) : (
            <div className={s.rows}>
              {listed.map((c) => (
                <Link key={c.slug} href={`/conferences/${c.slug}`} className={s.rowLink}>
                  <span className={s.rowName}>{c.name}</span>
                  <span className={s.rowCell}><b>Dates</b>{formatRange(c)}</span>
                  <span className={s.rowCell}><b>Host</b>{c.host}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
