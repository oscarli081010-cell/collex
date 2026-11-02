"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { clashesNear, SEASON_YEAR } from "@/lib/conferences";
import styles from "./DateChecker.module.css";

const DEFAULT = `${SEASON_YEAR}-03-13`;

export default function DateChecker() {
  const [date, setDate] = useState(DEFAULT);
  const id = useId();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const clashes = valid ? clashesNear(date) : [];
  const d = valid ? new Date(date + "T00:00:00") : null;
  const dayWord = d ? d.toLocaleDateString("en-AU", { weekday: "short" }).toLowerCase() : "—";
  const dayNum = d ? d.getDate() : "";
  const verdict = !valid ? "pick" : clashes.length === 0 ? "clear" : `${clashes.length} on`;

  return (
    <section className={`wrap ${styles.section}`} aria-labelledby={`${id}-h`}>
      <div className={`grid ${styles.top}`} data-reveal>
        <h2 id={`${id}-h`} className={styles.heading}>Check a date</h2>
        <div className={styles.intro}>
          <p>
            Choosing a weekend for your conference? Pick a date and Collex checks it against every listed
            conference that Friday to Sunday, so two secretariats never fight over the same delegates.
          </p>
          <label htmlFor={`${id}-in`} className={styles.label}>Your date</label>
          <input
            id={`${id}-in`}
            type="date"
            className={styles.input}
            value={date}
            min={`${SEASON_YEAR - 1}-01-01`}
            max={`${SEASON_YEAR + 1}-12-31`}
            onChange={(e) => setDate(e.target.value)}
          />
          <p className={styles.result} aria-live="polite">
            {!valid && "Pick a date to check it."}
            {valid && clashes.length === 0 && "Clear. Nothing listed that weekend yet."}
            {valid && clashes.length > 0 && (
              <>
                Also that weekend:{" "}
                {clashes.map((c, i) => (
                  <span key={c.slug}>
                    {i > 0 && ", "}
                    <Link className="link" href={`/conferences/${c.slug}`}>{c.name}</Link>
                  </span>
                ))}
              </>
            )}
          </p>
        </div>
      </div>
      <div className={styles.specimens} aria-hidden="true">
        <div className={styles.box}>
          <span className={`display num ${styles.giant}`}>{dayWord} {dayNum}</span>
        </div>
        <div className={`${styles.box} ${styles.boxAlt}`}>
          <span className={`display ${styles.giant} ${clashes.length ? styles.busy : ""}`}>{verdict}</span>
        </div>
      </div>
    </section>
  );
}
