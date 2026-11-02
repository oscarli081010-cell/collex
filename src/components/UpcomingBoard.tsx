"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { conferences, MONTHS, template, type Conference } from "@/lib/conferences";
import ConferenceRow from "./ConferenceRow";
import s from "./board.module.css";

// Search and filter the listed conferences, grouped by month.
export default function UpcomingBoard() {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("any");
  const [format, setFormat] = useState("any");
  const input = useRef<HTMLInputElement>(null);

  const filtered = Boolean(q || level !== "any" || format !== "any");
  const reset = () => { setQ(""); setLevel("any"); setFormat("any"); input.current?.focus(); };

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
  const filterKey = `${q}|${level}|${format}`;

  return (
    <div>
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
        <select className={`control ${level !== "any" ? s.active : ""}`} aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="any">All levels</option>
          <option>High school</option>
          <option>University</option>
          <option>Open</option>
        </select>
        <select className={`control ${format !== "any" ? s.active : ""}`} aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="any">All formats</option>
          <option>In person</option>
          <option>Online</option>
          <option>Hybrid</option>
        </select>
      </div>

      <div className={s.resultBar}>
        <span key={`${rows.length}-${filterKey}`} className="t-swap muted" aria-live="polite">
          {rows.length === 1 ? "1 conference" : `${rows.length} conferences`}
          {filtered ? " match" : " listed"}
        </span>
        <button className={s.resetBtn} data-shown={filtered} onClick={reset} tabIndex={filtered ? 0 : -1}>
          Clear filters
        </button>
      </div>

      <div key={filterKey}>
        {[...groups].map(([month, list]) => (
          <section key={month} className={s.group}>
            <h3 className={s.groupHead}>{month}</h3>
            <div className={`t-stagger ${s.list}`}>
              {list.map((c, i) => <div key={c.slug} style={{ "--i": i } as React.CSSProperties}><ConferenceRow c={c} /></div>)}
            </div>
          </section>
        ))}

        {rows.length === 0 && (
          <div className="t-stagger">
            <div className={s.empty} style={{ "--i": 0 } as React.CSSProperties}>
              <p className={s.emptyTitle}>{conferences.length === 0 ? "No conferences listed yet" : "No conferences match"}</p>
              {conferences.length === 0
                ? <Link href="/list" className="button secondary">List the first one</Link>
                : <button className="button secondary" onClick={reset}>Clear filters</button>}
            </div>
            {conferences.length === 0 && (
              <section className={s.group} style={{ "--i": 1 } as React.CSSProperties}>
                <h3 className={s.groupHead}>Example</h3>
                <ConferenceRow c={template} />
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
