"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MONTHS, onDay as runningOn, SEASON_YEAR } from "@/lib/conferences";
import { useConferences } from "./ConferencesContext";
import ConferenceRow from "./ConferenceRow";
import { usePill } from "./usePill";
import PageBand, { nextUp } from "./PageBand";
import board from "./board.module.css";
import s from "@/app/inner.module.css";

type YM = { y: number; m: number };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const isoOf = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function SeasonCalendar() {
  const [view, setView] = useState<YM>({ y: SEASON_YEAR, m: 2 });
  const [now, setNow] = useState<YM>({ y: -1, m: -1 });
  // Open on today's month. Done after mount so the prerendered page and the browser agree.
  useEffect(() => {
    const d = new Date();
    setNow({ y: d.getFullYear(), m: d.getMonth() });
    setView({ y: d.getFullYear(), m: d.getMonth() });
  }, []);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const { y, m } = view;
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const days = new Date(y, m + 1, 0).getDate();
  const cells = 42; // always six rows, so the grid never jumps in height
  const todayIso = isoOf(now.y, now.m, new Date().getDate());
  const conferences = useConferences();
  const onDay = (iso: string) => runningOn(conferences, iso);
  const listed = conferences.filter((c) => c.startDate?.startsWith(isoOf(y, m, 1).slice(0, 7)));
  const prevDays = new Date(y, m, 0).getDate();

  // Conferences starting in each month of the year on show, for the strip and the figures.
  const perMonth = MONTHS.map((_, i) => conferences.filter((c) => c.startDate?.startsWith(isoOf(y, i, 1).slice(0, 7))).length);
  const total = perMonth.reduce((a, b) => a + b, 0);
  const go = (to: number) => { if (to !== m) { setDir(to > m ? "next" : "prev"); setView({ y, m: to }); } };
  const stepYear = (n: number) => { setDir(n > 0 ? "next" : "prev"); setView({ y: y + n, m }); };
  const track = useRef<HTMLDivElement>(null);
  const pill = usePill(track, '[aria-selected="true"]', `${y}-${m}`);
  // Left and right arrows walk the months, rolling into the next or previous year.
  const onTrackKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const t = new Date(y, m + (e.key === "ArrowRight" ? 1 : -1), 1);
    setDir(e.key === "ArrowRight" ? "next" : "prev");
    setView({ y: t.getFullYear(), m: t.getMonth() });
    requestAnimationFrame(() => track.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  };

  return (
    <>
      <PageBand
        title="Calendar"
        accent={<span key={y} className="t-swap">{y}</span>}
        figures={[
          { label: "Conferences", value: String(total) },
          nextUp(conferences),
        ]}
      >
        <div className={s.monthBar}>
          <div className={s.yearStep}>
            <button onClick={() => stepYear(-1)} aria-label={`Show ${y - 1}`}>
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8 10 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span key={y} className="t-swap">{y}</span>
            <button onClick={() => stepYear(1)} aria-label={`Show ${y + 1}`}>
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
          <div ref={track} className={s.months} role="tablist" aria-label={`Months of ${y}`} onKeyDown={onTrackKey}>
            <span ref={pill} className={`t-pill ${s.monthPill}`} aria-hidden="true" />
            {MONTHS.map((name, i) => (
              <button
                key={name}
                role="tab"
                aria-selected={m === i}
                tabIndex={m === i ? 0 : -1}
                data-now={y === now.y && i === now.m ? "true" : undefined}
                aria-label={`${name} ${y}, ${perMonth[i]} conference${perMonth[i] === 1 ? "" : "s"}`}
                onClick={() => go(i)}
              >
                {name.slice(0, 3)}
                <span className={s.dots} aria-hidden="true">
                  {Array.from({ length: Math.min(perMonth[i], 3) }, (_, k) => <i key={k} />)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </PageBand>


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
