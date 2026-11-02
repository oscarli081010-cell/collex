"use client";

import Link from "next/link";
import { useState } from "react";
import { allPages, conferences, formatRange, MONTHS, NA, type Conference } from "@/lib/conferences";
import s from "@/app/inner.module.css";

export default function Directory() {
  const [month, setMonth] = useState("any");
  const [level, setLevel] = useState("any");
  const [format, setFormat] = useState("any");

  const match = (c: Conference) =>
    c.isTemplate ||
    ((month === "any" || (c.startDate && new Date(c.startDate).getMonth() === Number(month))) &&
      (level === "any" || c.level === level) &&
      (format === "any" || c.format === format));

  const rows = allPages.filter(match);

  return (
    <>
      <div className={s.filters}>
        <label>
          Month
          <select className={s.select} value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="any">Any month</option>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </label>
        <label>
          Level
          <select className={s.select} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="any">Any level</option>
            <option>High school</option>
            <option>University</option>
            <option>Open</option>
          </select>
        </label>
        <label>
          Format
          <select className={s.select} value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="any">Any format</option>
            <option>In person</option>
            <option>Online</option>
            <option>Hybrid</option>
          </select>
        </label>
      </div>

      <div className={s.rowHead} aria-hidden="true">
        <span>Conference</span><span>Dates</span><span>Host</span><span>Level</span><span>Committees</span><span />
      </div>
      <ul className={s.rows}>
        {rows.map((c) => (
          <li key={c.slug}>
            <Link href={`/conferences/${c.slug}`} className={s.rowLink}>
              <span className={s.rowName}>
                {c.name}
                {c.isTemplate && <small>The standard page, before any conference is listed</small>}
              </span>
              <span className={s.rowCell}><b>Dates</b>{formatRange(c)}</span>
              <span className={s.rowCell}><b>Host</b>{c.host}</span>
              <span className={s.rowCell}><b>Level</b>{c.level ?? NA}</span>
              <span className={s.rowCell}><b>Committees</b>{c.committees.some((x) => x.name !== NA) ? c.committees.length : NA}</span>
              <span className={s.go} aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>

      {conferences.length === 0 && (
        <div className={s.empty} style={{ marginTop: 40, maxWidth: 720 }}>
          <p>No conferences are listed yet. The first secretariat to list theirs appears here, on the calendar and on its own page.</p>
          <Link href="/list" className="button">List your conference <span className="arrow" aria-hidden="true">→</span></Link>
        </div>
      )}
    </>
  );
}
