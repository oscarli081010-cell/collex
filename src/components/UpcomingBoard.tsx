"use client";

import Link from "next/link";
import { useState } from "react";
import { conferences, MONTHS, template, type Conference } from "@/lib/conferences";
import ConferenceRow from "./ConferenceRow";
import s from "./board.module.css";

// Search and filter the listed conferences, grouped by month.
export default function UpcomingBoard() {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("any");
  const [format, setFormat] = useState("any");

  const match = (c: Conference) =>
    (!q || `${c.name} ${c.host} ${c.venue}`.toLowerCase().includes(q.toLowerCase())) &&
    (level === "any" || c.level === level) &&
    (format === "any" || c.format === format);

  const rows = conferences.filter(match).sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  const groups = new Map<string, Conference[]>();
  for (const c of rows) {
    const key = c.startDate ? `${MONTHS[new Date(c.startDate).getMonth()]} ${c.startDate.slice(0, 4)}` : "Date to be announced";
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  return (
    <div>
      <div className={s.toolbar} role="search">
        <label className={s.search}>
          <span className="sr-only">Search conferences</span>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <input className="control" placeholder="Search by conference, school or venue" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="control" aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="any">All levels</option>
          <option>High school</option>
          <option>University</option>
          <option>Open</option>
        </select>
        <select className="control" aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="any">All formats</option>
          <option>In person</option>
          <option>Online</option>
          <option>Hybrid</option>
        </select>
      </div>

      {[...groups].map(([month, list]) => (
        <section key={month} className={s.group}>
          <h3 className={s.groupHead}>{month}</h3>
          <div className={s.list}>{list.map((c) => <ConferenceRow key={c.slug} c={c} />)}</div>
        </section>
      ))}

      {rows.length === 0 && (
        <>
          <div className={s.empty}>
            <p className={s.emptyTitle}>{conferences.length === 0 ? "No conferences listed yet" : "No conferences match"}</p>
            <p className="muted">
              {conferences.length === 0
                ? "The 2027 season starts here. Each conference appears as a row like the example below."
                : "Try a different search or clear the filters."}
            </p>
            {conferences.length === 0 && <Link href="/list" className="button secondary">List the first one</Link>}
          </div>
          {conferences.length === 0 && (
            <section className={s.group}>
              <h3 className={s.groupHead}>How a listing looks</h3>
              <div className={s.list}><ConferenceRow c={template} /></div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
