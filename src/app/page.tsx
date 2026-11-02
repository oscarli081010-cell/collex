import Link from "next/link";
import UpcomingBoard from "@/components/UpcomingBoard";
import MiniCalendar from "@/components/MiniCalendar";
import { conferences, NA, SEASON_YEAR, formatRange } from "@/lib/conferences";
import styles from "./home.module.css";

const PAGE_PARTS = [
  ["Overview", "Dates, venue, host school and fees"],
  ["Committees", "Each committee, its topic and its chairs"],
  ["Background guides", "Released and downloadable in one place"],
  ["Secretariat", "Who runs it, by name and role"],
  ["Key dates", "Registration, allocations and paper deadlines"],
  ["Applications", "Delegations and chairs apply on the page"],
];

export default function Home() {
  const next = [...conferences]
    .filter((c) => c.startDate && c.startDate >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!))[0];

  return (
    <main id="top">
      <section className={`container ${styles.intro}`} data-reveal>
        <div className={styles.introText}>
          <h1 className={`serif ${styles.title}`}>
            Every Model UN conference in Sydney, <em>in one place.</em>
          </h1>
          <p className={styles.lead}>
            The circuit&rsquo;s shared calendar. Find a conference, check a date, and get every detail from
            one standard page.
          </p>
        </div>
        <dl className={styles.stats}>
          <div><dt>Listed for {SEASON_YEAR}</dt><dd className="serif num">{conferences.length}</dd></div>
          <div><dt>Next conference</dt><dd className="serif">{next ? next.shortName : NA}</dd></div>
          <div><dt>Next date</dt><dd className="serif">{next ? formatRange(next) : NA}</dd></div>
        </dl>
      </section>

      <section className={`container ${styles.board}`} aria-labelledby="upcoming-h">
        <div className={styles.boardMain}>
          <div className={styles.boardHead}>
            <h2 id="upcoming-h" className={`serif ${styles.h2}`}>Upcoming conferences</h2>
            <Link href="/conferences" className="link">View all</Link>
          </div>
          <UpcomingBoard />
        </div>
        <aside className={styles.side}>
          <MiniCalendar />
          <div className={`panel ${styles.sideCard}`}>
            <h2 className={`serif ${styles.sideTitle}`}>Running a conference?</h2>
            <p className="muted">
              List it once and it gets a page and a place on the calendar. Free, and it takes five minutes.
            </p>
            <Link href="/list" className="button">List a conference</Link>
          </div>
        </aside>
      </section>

      <section className={`container ${styles.standard}`} aria-labelledby="standard-h">
        <div className={styles.standardHead} data-reveal>
          <h2 id="standard-h" className={`serif ${styles.h2}`}>Every conference gets the same page</h2>
          <p className="muted">So delegates always know where to look, whichever conference they&rsquo;re going to.</p>
        </div>
        <div className={styles.standardBody} data-reveal>
          <ul className={styles.parts}>
            {PAGE_PARTS.map(([t, d]) => (
              <li key={t}>
                <span className={styles.partTitle}>{t}</span>
                <span className="muted">{d}</span>
              </li>
            ))}
          </ul>
          <Link href="/conferences/template" className={`panel ${styles.preview}`} aria-label="Open the standard conference page">
            <span className={styles.previewCover} />
            <span className={styles.previewBody}>
              <span className="badge accent">Example listing</span>
              <span className={`serif ${styles.previewTitle}`}>Conference name</span>
              <span className="muted">Host school {NA} · Dates {NA}</span>
              <span className={styles.previewTabs}>
                <span data-on>Overview</span><span>Committees</span><span>Guides</span><span>Apply</span>
              </span>
              <span className={styles.previewFacts}>
                {["Venue", "Level", "Fee", "Delegates"].map((k) => (
                  <span key={k}><small>{k}</small>{NA}</span>
                ))}
              </span>
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
