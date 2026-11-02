import Link from "next/link";
import UpcomingBoard from "@/components/UpcomingBoard";
import MiniCalendar from "@/components/MiniCalendar";
import { conferences, NA, formatRange } from "@/lib/conferences";
import styles from "./home.module.css";

export default function Home() {
  const next = [...conferences]
    .filter((c) => c.startDate && c.startDate >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!))[0];

  return (
    <main id="top">
      <section className={`container ${styles.hero}`}>
        <div className={styles.heroText} data-reveal>
          <h1 className={`serif ${styles.title}`}>
            Sydney Model UN, <em>in one place.</em>
          </h1>
          <p className={styles.lead}>Every conference on the circuit, with one page each to apply.</p>
          <div className={styles.heroActions}>
            <a href="#upcoming" className="button lg">See what&rsquo;s on</a>
            <Link href="/list" className="button secondary lg">List a conference</Link>
          </div>
        </div>
        <div className={styles.heroPic}>
          <span className={styles.heroImg} role="img" aria-label="The UN General Assembly hall" />
          <Link href={next ? `/conferences/${next.slug}` : "/calendar"} className={styles.nextCard}>
            <span className={styles.nextLabel}>Next conference</span>
            <span className={`serif ${styles.nextName}`}>{next ? next.name : NA}</span>
            <span className="muted">{next ? formatRange(next) : "Dates to be announced"}</span>
          </Link>
        </div>
        <a href="#upcoming" className={styles.scrollCue}>
          Upcoming
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
      </section>

      <section id="upcoming" className={`container ${styles.board}`} aria-labelledby="upcoming-h">
        <div>
          <div className={styles.boardHead}>
            <h2 id="upcoming-h" className={`serif ${styles.h2}`}>Upcoming</h2>
            <Link href="/calendar" className="link">Open calendar →</Link>
          </div>
          <UpcomingBoard />
        </div>
        <aside className={styles.side}>
          <MiniCalendar />
          <div className={`panel ${styles.sideCard}`}>
            <h2 className={`serif ${styles.sideTitle}`}>Running a conference?</h2>
            <Link href="/list" className="button">List it free</Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
