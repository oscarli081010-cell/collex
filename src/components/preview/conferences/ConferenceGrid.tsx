"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isPast, monthLabel, todayInSydney, type ConferenceSummary } from "@/lib/conferences";
import { useConferences } from "@/components/ConferencesContext";
import { Placard } from "@/components/Drawings";
import PageBand, { nextUp } from "@/components/PageBand";
import Select from "@/components/Select";
import s from "@/components/board.module.css";
import g from "@/app/preview/conferences/conferences.module.css";
import ConferenceCard from "./ConferenceCard";

// Keeps ?month= in the address, so a filtered grid can be shared or bookmarked.
const writeMonth = (month: string) => {
  const url = new URL(location.href);
  if (month === "any") url.searchParams.delete("month"); else url.searchParams.set("month", month);
  history.replaceState(history.state, "", url);
};

// Upcoming conferences as one grid of cards, soonest first, those without a date last.
// The search and filters sit under the headline panel.
export default function ConferenceGrid() {
  const today = todayInSydney();
  const conferences = useConferences().filter((c) => !isPast(c, today));
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("any");
  const [month, setMonth] = useState("any");
  // ?q= prefills the search; ?month=2027-03 picks a month.
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    if (p.get("q")) setQ(p.get("q")!);
    if (/^\d{4}-\d{2}$/.test(p.get("month") ?? "")) setMonth(p.get("month")!);
  }, []);
  const input = useRef<HTMLInputElement>(null);

  const months = [...new Set(conferences.map((c) => c.startDate?.slice(0, 7)).filter(Boolean) as string[])].sort();
  if (month !== "any" && !months.includes(month)) months.push(month);
  const pickMonth = (m: string) => { setMonth(m); writeMonth(m); };

  const filtered = Boolean(q || level !== "any" || month !== "any");
  const reset = () => { setQ(""); setLevel("any"); pickMonth("any"); input.current?.focus(); };

  const match = (c: ConferenceSummary) =>
    (!q || `${c.name} ${c.host} ${c.venue}`.toLowerCase().includes(q.toLowerCase())) &&
    (level === "any" || c.level === level) &&
    (month === "any" || c.startDate?.startsWith(month));

  const cards = conferences.filter(match).sort((a, b) =>
    a.startDate && b.startDate ? a.startDate.localeCompare(b.startDate) : a.startDate ? -1 : b.startDate ? 1 : a.name.localeCompare(b.name));
  const filterKey = `${q}|${level}|${month}`;

  return (
    <div>
      <PageBand
        title="Conferences"
        tight
        figures={[
          { label: "Upcoming", value: String(conferences.length) },
          { label: "Host schools", value: String(new Set(conferences.map((c) => c.host)).size) },
          nextUp(conferences),
        ]}
      />

      <div className={s.toolbar} role="search">
        <label className={s.search}>
          <span className="sr-only">Search conferences</span>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <input
            ref={input}
            className="control"
            placeholder="Search conferences or schools"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQ("")}
          />
          <button
            className={s.clearX}
            data-shown={Boolean(q)}
            onClick={() => { setQ(""); input.current?.focus(); }}
            aria-label="Clear search"
            tabIndex={q ? 0 : -1}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </label>
        <Select className={`control ${month !== "any" ? s.active : ""}`} aria-label="Month" value={month} onChange={(e) => pickMonth(e.target.value)}>
          <option value="any">Any month</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </Select>
        <Select className={`control ${level !== "any" ? s.active : ""}`} aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="any">All levels</option>
          <option>High school</option>
          <option>University</option>
          <option>Open</option>
        </Select>
      </div>

      {filtered && (
        <div className={s.resultBar}>
          <span key={`${cards.length}-${filterKey}`} className="t-swap muted" aria-live="polite">
            {cards.length === 1 ? "1 conference matches" : `${cards.length} conferences match`}
          </span>
          <button className={s.resetBtn} data-shown onClick={reset}>
            Clear filters
          </button>
        </div>
      )}

      {cards.length > 0 ? (
        <ul key={filterKey} className={`t-stagger ${g.grid} ${filtered ? g.gridFiltered : ""}`}>
          {cards.map((c, i) => <li key={c.slug} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}><ConferenceCard c={c} today={today} /></li>)}
        </ul>
      ) : (
        <div className="t-stagger">
          <div className={s.empty} style={{ "--i": 0 } as React.CSSProperties}>
            <Placard />
            <p className={s.emptyTitle}>{conferences.length === 0 ? "Nothing coming up yet" : "No conferences match"}</p>
            <p className="muted">
              {conferences.length === 0
                ? "When a secretariat lists its conference, it appears here."
                : "Try another month or level, or clear the search."}
            </p>
            {conferences.length === 0
              ? <Link href="/list" className="button secondary">List the First One</Link>
              : <button className="button secondary" onClick={reset}>Clear Filters</button>}
          </div>
        </div>
      )}

      <p className={s.pastLink}><Link href="/past" className="link">Past conferences →</Link></p>
    </div>
  );
}
