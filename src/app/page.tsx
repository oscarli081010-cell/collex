import Link from "next/link";
import UpcomingBoard from "@/components/UpcomingBoard";
import MiniCalendar from "@/components/MiniCalendar";
import NextCard from "@/components/NextCard";
import styles from "./home.module.css";

export default function Home() {
  return (
    <main id="top">
      <section className={`container ${styles.hero}`}>
        <div className={styles.heroText} data-reveal>
          <h1 className={`serif ${styles.title}`}>
            Sydney Model UN, <em>in one place.</em>
          </h1>
          <p className={styles.lead}>From the first gavel to the final resolution, <span className={styles.aura}>the whole Sydney circuit lives here.</span></p>
          <div className={styles.heroActions}>
            <a href="#upcoming" className="button lg">See what&rsquo;s on</a>
            <Link href="/list" className="button secondary lg">List a conference</Link>
          </div>
        </div>
        <div className={styles.heroPic}>
          <span className={styles.heroImg} role="img" aria-label="The UN General Assembly hall" />
          <NextCard />
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
