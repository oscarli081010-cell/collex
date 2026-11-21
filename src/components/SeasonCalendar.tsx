"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatRange, MONTHS, NA, onDay as runningOn, todayInSydney } from "@/lib/conferences";
import { useConferences } from "./ConferencesContext";
import ConferenceRow from "./ConferenceRow";
import MonthPicker, { type YM } from "./MonthPicker";
import YearPicker from "./YearPicker";
import YearCalendar from "./YearCalendar";
import CalendarViewToggle from "./CalendarViewToggle";
import PageBand, { nextUp } from "./PageBand";
import IconButton, { ICONS } from "./IconButton";
import board from "./board.module.css";
import s from "@/app/inner.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const isoOf = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function SeasonCalendar() {
  // Starts on this month (Sydney time), so the page is right from the first paint instead of jumping after it loads.
  const [view, setView] = useState<YM>(() => { const t = todayInSydney(); return { y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) - 1 }; });
  const [now, setNow] = useState<YM>({ y: -1, m: -1 });
  // "Today" is marked after mount, so the prerendered page and the browser agree.
  useEffect(() => {
    const d = new Date();
    setNow({ y: d.getFullYear(), m: d.getMonth() });
  }, []);
  const [dir, setDir] = useState<"next" | "prev">("next");
  // One month at a time, or the whole year at once.
  const [mode, setMode] = useState<"month" | "year">("month");
  // The day tapped on a phone, whose conferences show in a card under the month.
  const [picked, setPicked] = useState<string | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const { y, m } = view;
  useEffect(() => { setPicked(null); }, [y, m, mode]);
  useEffect(() => { if (picked) card.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [picked]);
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const days = new Date(y, m + 1, 0).getDate();
  const cells = 42; // always six rows, so the grid never jumps in height
  const todayIso = isoOf(now.y, now.m, new Date().getDate());
  const conferences = useConferences();
  const onDay = (iso: string) => runningOn(conferences, iso);
  const listed = conferences.filter((c) => c.startDate?.startsWith(mode === "year" ? String(y) : isoOf(y, m, 1).slice(0, 7)));
  const prevDays = new Date(y, m, 0).getDate();
  // For an empty month: the first conference that starts after it, so there's somewhere to go next.
  const monthEnd = isoOf(y, m, days);
  const next = conferences.filter((c) => c.startDate && c.startDate > monthEnd).sort((a, b) => a.startDate!.localeCompare(b.startDate!))[0];
  const nextWhen = next && new Date(next.startDate! + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", ...(next.startDate!.slice(0, 4) !== String(y) && { year: "numeric" }) });

  // Conferences starting in each month of the year on show.
  const perMonth = MONTHS.map((_, i) => conferences.filter((c) => c.startDate?.startsWith(isoOf(y, i, 1).slice(0, 7))).length);
  const total = perMonth.reduce((a, b) => a + b, 0);
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
        <div className={s.calBar}>
          <CalendarViewToggle mode={mode} onChange={setMode} />
          {mode === "month"
            ? <MonthPicker value={view} onChange={(v, d) => { setDir(d); setView(v); }} />
            : <YearPicker year={y} onChange={(ny, d) => { setDir(d); setView({ y: ny, m }); }} />}
        </div>
      </PageBand>


      <div id="cal-panel-month" role="tabpanel" aria-labelledby="cal-tab-month" hidden={mode !== "month"} className={s.calGrid}>
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
                {onDay(iso).length > 0 && (
                  <button type="button" className={s.dayHit} aria-pressed={picked === iso} onClick={() => setPicked(picked === iso ? null : iso)}
                    aria-label={`${d} ${MONTHS[m]}: ${onDay(iso).length} ${onDay(iso).length === 1 ? "conference" : "conferences"}`} />
                )}
                {onDay(iso).map((c) => {
                  const tip = `pv-${iso}-${c.slug}`;
                  // Hover or keyboard focus shows a small card with the conference's details.
                  return (
                    <span key={c.slug} className={s.evWrap} data-edge={i % 7 >= 5 ? "end" : undefined}>
                      <Link href={`/conferences/${c.slug}`} className={s.event} aria-describedby={tip}>{c.shortName}</Link>
                      <span id={tip} role="tooltip" className={s.preview}>
                        <span className={s.previewName}>{c.name}</span>
                        <span>{formatRange(c)}</span>
                        <span className="muted">{c.host}{c.venue !== NA ? ` · ${c.venue}` : ""}</span>
                      </span>
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div id="cal-panel-year" role="tabpanel" aria-labelledby="cal-tab-year" hidden={mode !== "year"}>
        {mode === "year" && (
          <div key={y} className="t-slide" data-dir={dir}>
            <YearCalendar year={y} todayIso={todayIso} onDay={onDay} picked={picked} onPick={setPicked} onOpenMonth={(mm) => { setDir("next"); setView({ y, m: mm }); setMode("month"); }} />
          </div>
        )}
      </div>

      {picked && (
        <div ref={card} className={`panel t-reveal ${s.dayCard} ${mode === "year" ? s.dayCardAlways : ""}`} role="region" aria-label={`Conferences on ${picked}`}>
          <div className={s.dayCardHead}>
            <strong>{new Date(picked + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</strong>
            <IconButton label="Close" tip="Close" icon={ICONS.close} onClick={() => setPicked(null)} />
          </div>
          <ul>
            {onDay(picked).map((c) => (
              <li key={c.slug}><Link href={`/conferences/${c.slug}`}><span>{c.name}</span><span>{formatRange(c)} · {c.host}</span></Link></li>
            ))}
          </ul>
        </div>
      )}

      <section className={s.agenda} aria-labelledby="agenda-h">
        <h2 id="agenda-h" className={s.h2}>
          On in <span key={`${y}-${m}-${mode}`} className="t-swap">{mode === "year" ? y : MONTHS[m]}</span>
        </h2>
        {listed.length === 0 ? (
          <div key={`${y}-${m}-${mode}`} className={`t-reveal ${board.empty}`}>
            <p className={board.emptyTitle}>Nothing on in {mode === "year" ? y : MONTHS[m]}.</p>
            {next && <Link href={`/conferences/${next.slug}`} className="link">The next conference is on {nextWhen} →</Link>}
            <Link href="/list" className="button secondary">List a Conference</Link>
          </div>
        ) : (
          <div className={`t-stagger ${board.list}`}>
            {listed.map((c, i) => <div key={c.slug} style={{ "--i": i } as React.CSSProperties}><ConferenceRow c={c} /></div>)}
          </div>
        )}
        <div className={`callout ${s.subscribe}`}>
          <span className="calloutIcon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3M8 8.5v3M6.5 10h3" /></svg>
          </span>
          <h3 className="calloutTitle">Keep the season in your own calendar</h3>
          <p className="calloutText">Subscribe once and new conferences appear in Apple, Google or Outlook Calendar as they&rsquo;re listed.</p>
          <div className="calloutActions">
            <a href="webcal://collex.au/calendar.ics" className="button">Subscribe</a>
            <a href="/calendar.ics" className="button secondary" download="collex.ics">Download .ics</a>
          </div>
        </div>
      </section>
    </>
  );
}
