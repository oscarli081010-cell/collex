import Link from "next/link";
import Image from "next/image";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import DateChecker from "@/components/DateChecker";
import { conferences, inMonth, MONTHS, SEASON_YEAR } from "@/lib/conferences";
import styles from "./home.module.css";

const PAGE_PARTS = [
  ["Dates and venue", "When it runs, where, and which school hosts it."],
  ["Committees", "Every committee with its topic and its chairs."],
  ["Background guides", "Released and downloadable from one place."],
  ["Secretariat", "Who runs the conference, by name and role."],
  ["Fees and registration", "What it costs and how a school signs up."],
  ["Applications", "Chair and delegation applications, on the page."],
];

export default function Home() {
  const listed = conferences.length;
  return (
    <main id="top">
      {/* Hero */}
      <section className={styles.hero}>
        <Image
          className={styles.heroImg}
          src="/img/general-assembly.jpg"
          alt="The United Nations General Assembly Hall in New York, full of delegates"
          fill
          priority
          sizes="100vw"
          data-drift
        />
        <div className={styles.scrim} aria-hidden="true" />
        <TopBar overlay />
        <div className={styles.heroInner} data-reveal>
          <p className="kicker">The Sydney Model United Nations circuit</p>
          <h1 className={`display ${styles.heroTitle}`}>Collex</h1>
          <p className={styles.heroLead}>
            Every Model UN conference in Sydney, on one calendar, with one standard page each.
          </p>
          <div className={styles.heroActions}>
            <Link href="/calendar" className="button light">
              View the {SEASON_YEAR} season
            </Link>
            <Link href="/list" className={`link ${styles.heroLink}`}>List a conference</Link>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className={`wrap ${styles.intro}`} aria-labelledby="intro-h">
        <div className={styles.introInner} data-reveal>
          <h2 id="intro-h" className={`serif ${styles.introText}`}>
            One place for the whole circuit, so delegates, chairs and secretariats stop
            searching through posts, forms and shared drives.
          </h2>
          <span className={styles.rule} aria-hidden="true" />
        </div>
      </section>

      {/* Season */}
      <section className={`wrap ${styles.season}`} aria-labelledby="season-h">
        <div className={styles.sectionHead} data-reveal>
          <p className="kicker">Calendar</p>
          <h2 id="season-h" className={`display ${styles.h2}`}>The {SEASON_YEAR} season</h2>
          <p className="muted">
            {listed === 0
              ? "No conferences are listed yet. Each month fills in as secretariats list theirs."
              : `${listed} conferences listed so far.`}
          </p>
        </div>
        <ol className={styles.months} data-reveal>
          {MONTHS.map((m, i) => {
            const n = inMonth(i).length;
            return (
              <li key={m}>
                <Link href="/calendar" className={styles.month}>
                  <span className={`serif ${styles.monthName}`}>{m}</span>
                  <span className={`num ${styles.monthCount}`}>{n ? `${n} listed` : "N/A"}</span>
                </Link>
              </li>
            );
          })}
        </ol>
        <div className={styles.center}>
          <Link href="/calendar" className="button ghost">Open the calendar</Link>
        </div>
      </section>

      <figure className={styles.panorama}>
        <div className={styles.panoramaFrame}>
          <Image
            src="/img/harbour-bridge.jpg"
            alt="Sydney Harbour Bridge and the city at night, seen from Kirribilli"
            width={1920}
            height={479}
            sizes="100vw"
            data-drift
          />
        </div>
      </figure>

      {/* Standard page */}
      <section className={`wrap ${styles.standard}`} aria-labelledby="standard-h">
        <div className={styles.standardHead} data-reveal>
          <p className="kicker">Conference pages</p>
          <h2 id="standard-h" className={`display ${styles.h2}`}>One page for every conference</h2>
          <p className="muted">
            Every listing gets the same page, so the answer is always in the same place.
          </p>
        </div>
        <ul className={styles.parts} data-reveal>
          {PAGE_PARTS.map(([t, d]) => (
            <li key={t} className={styles.part}>
              <h3 className="serif">{t}</h3>
              <p className="muted">{d}</p>
            </li>
          ))}
        </ul>
        <div className={styles.center}>
          <Link href="/conferences/template" className="button ghost">See the standard page</Link>
        </div>
      </section>

      <DateChecker />

      {/* For secretariats */}
      <section className={`wrap grid ${styles.how}`} aria-labelledby="how-h">
        <figure className={styles.howPic}>
          <Image
            src="/img/town-hall.jpg"
            alt="Sydney Town Hall's sandstone clock tower on George Street"
            width={1920}
            height={1440}
            sizes="(max-width: 760px) 100vw, 45vw"
          />
        </figure>
        <div className={styles.howCopy} data-reveal>
          <p className="kicker">For secretariats</p>
          <h2 id="how-h" className={`display ${styles.h2}`}>Listing takes one email</h2>
          <p>
            Send the details you already have. Anything you don&rsquo;t know yet shows as N/A and can be
            filled in later. Listing is free.
          </p>
          <ol className={styles.steps}>
            <li><span className="serif">I.</span> Fill in the listing form</li>
            <li><span className="serif">II.</span> We confirm with your secretariat</li>
            <li><span className="serif">III.</span> Your page goes live on the calendar</li>
          </ol>
          <Link href="/list" className="button">List a conference</Link>
        </div>
      </section>

      {/* Close */}
      <section className={styles.cta} aria-labelledby="cta-h">
        <Image
          className={styles.heroImg}
          src="/img/security-council.jpg"
          alt="The empty United Nations Security Council chamber, with its horseshoe table and red seats"
          fill
          sizes="100vw"
          data-drift
        />
        <div className={styles.scrim} aria-hidden="true" />
        <div className={styles.ctaInner} data-reveal>
          <h2 id="cta-h" className={`display ${styles.ctaHead}`}>Be first on the calendar</h2>
          <p>The first conferences listed set the standard for the circuit.</p>
          <Link href="/list" className="button light">List your conference</Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
