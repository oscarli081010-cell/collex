"use client";

import Link from "next/link";
import { useState } from "react";
import { MONTHS, onDay as runningOn, SEASON_YEAR } from "@/lib/conferences";
import { useConferences } from "./ConferencesContext";
import ConferenceRow from "./ConferenceRow";
import MonthPicker, { type YM } from "./MonthPicker";
import PageBand, { nextUp } from "./PageBand";
import board from "./board.module.css";
import s from "@/app/inner.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const isoOf = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function SeasonCalendar() {
  const [view, setView] = useState<YM>({ y: SEASON_YEAR, m: 2 }); // March: the season usually starts here
  const [dir, setDir] = useState<"next" | "prev">("next");
  const { y, m } = view;
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const days = new Date(y, m + 1, 0).getDate();
  const cells = 42; // always six rows, so the grid never jumps in height
  const todayIso = new Date().toISOString().slice(0, 10);
  const conferences = useConferences();
  const onDay = (iso: string) => runningOn(conferences, iso);
  const listed = conferences.filter((c) => c.startDate?.startsWith(isoOf(y, m, 1).slice(0, 7)));
  const prevDays = new Date(y, m, 0).getDate();

  // Conferences starting in each month of the season, for the strip and the figures.
  const perMonth = MONTHS.map((_, i) => conferences.filter((c) => c.startDate?.startsWith(isoOf(SEASON_YEAR, i, 1).slice(0, 7))).length);
  const total = perMonth.reduce((a, b) => a + b, 0);
  const peak = Math.max(...perMonth);
  const go = (to: number) => { if (to !== m || y !== SEASON_YEAR) { setDir(y * 12 + m < SEASON_YEAR * 12 + to ? "next" : "prev"); setView({ y: SEASON_YEAR, m: to }); } };

  return (
    <>
      <PageBand
        title="Calendar"
        accent={String(SEASON_YEAR)}
        figures={[
          { label: "Conferences", value: String(total) },
          { label: "Busiest month", value: peak ? MONTHS[perMonth.indexOf(peak)].slice(0, 3) : "TBA" },
          nextUp(conferences),
        ]}
      >
        <div className={s.strip} role="group" aria-label={`Jump to a month of ${SEASON_YEAR}`}>
          {MONTHS.map((name, i) => (
            <button
              key={name}
              className={s.stripMonth}
              aria-pressed={y === SEASON_YEAR && m === i}
              aria-label={`${name}: ${perMonth[i]} conference${perMonth[i] === 1 ? "" : "s"}`}
              onClick={() => go(i)}
            >
              <span className={s.stripBar} style={{ "--h": peak ? perMonth[i] / peak : 0 } as React.CSSProperties} />
              <span className={s.stripName}>{name.slice(0, 3)}</span>
            </button>
          ))}
        </div>
      </PageBand>

      <div className={s.calBar}>
        <MonthPicker value={view} onChange={(v, d) => { setDir(d); setView(v); }} />
        <span key={`${y}-${m}`} className="t-swap muted">
          {listed.length === 0 ? "Nothing listed yet" : listed.length === 1 ? "1 conference" : `${listed.length} conferences`}
        </span>
      </div>

      <div className={s.calGrid}>
        <div className={s.weekdays} aria-hidden="true">
          {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
        </div>
        <div key={`${y}-${m}`} className={`t-slide ${s.days}`} data-dir={dir} role="grid" aria-label={`${MONTHS[m]} ${y}`}>
          {Array.from({ length: cells }, (_, i) => {
            const d = i - lead + 1;
            if (d < 1 || d > days) {
              return <div key={i} className={`${s.day} ${s.blank}`} aria-hidden="true"><span className={s.dayNum}>{d < 1 ? prevDays + d : d - days}</span></div>;
            }
            const iso = isoOf(y, m, d);
            return (
              <div key={i} role="gridcell" className={`${s.day} ${i % 7 >= 5 ? s.weekend : ""} ${iso === todayIso ? s.today : ""} ${onDay(iso).length ? s.busy : ""}`}>
                <span className={s.dayNum}>{d}</span>
                {onDay(iso).map((c) => (
                  <Link key={c.slug} href={`/conferences/${c.slug}`} className={s.event}>{c.shortName}</Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <section className={s.agenda} aria-labelledby="agenda-h">
        <h2 id="agenda-h" className={s.h2}>
          On in <span key={`${y}-${m}`} className="t-swap">{MONTHS[m]}</span>
        </h2>
        {listed.length === 0 ? (
          <div key={`${y}-${m}`} className={`t-reveal ${board.empty}`}>
            <p className={board.emptyTitle}>Nothing listed for {MONTHS[m]} {y}</p>
            <Link href="/list" className="button secondary">List a conference</Link>
          </div>
        ) : (
          <div className={`t-stagger ${board.list}`}>
            {listed.map((c, i) => <div key={c.slug} style={{ "--i": i } as React.CSSProperties}><ConferenceRow c={c} /></div>)}
          </div>
        )}
      </section>
    </>
  );
}
