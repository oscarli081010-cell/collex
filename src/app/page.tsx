import type { Metadata } from "next";
import Link from "next/link";
import UpcomingBoard from "@/components/UpcomingBoard";
import MiniCalendar from "@/components/MiniCalendar";
import NextCard from "@/components/NextCard";
import Reveal from "@/components/Reveal";
import styles from "./home.module.css";

// The title and description come from the layout; the home page just names its own address.
export const metadata: Metadata = { alternates: { canonical: "/" } };

// schema.org data naming the site and who runs it, for search results.
const SITE = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Collex",
  url: "https://collex.au",
  description: "A calendar of Model United Nations conferences in Sydney, each with its own page.",
  publisher: { "@id": "https://collex.au/#organization" },
};

const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://collex.au/#organization",
  name: "Collex",
  url: "https://collex.au",
  logo: "https://collex.au/pwa-512.png",
  email: "hello@collex.au",
  address: { "@type": "PostalAddress", addressLocality: "Sydney", addressRegion: "NSW", addressCountry: "AU" },
};

const HERO = (ext: string) => [640, 960, 1440].map((w) => `/img/general-assembly-${w}.${ext} ${w}w`).join(", ");
const HERO_SIZES = "(max-width: 980px) calc(100vw - 40px), 620px";

export default function Home() {
  return (
    <main id="top">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([SITE, ORGANIZATION]) }} />
      <section className={`container ${styles.hero}`}>
        <Reveal className={styles.heroText}>
          <h1 className={`serif ${styles.title}`}>
            Sydney Model UN, <em>in one place.</em>
          </h1>
          <p className={styles.lead}>Upcoming conferences, dates and links, <span className={styles.aura}>on one calendar.</span></p>
          <div className={styles.heroActions}>
            <a href="#upcoming" className="button lg">See What&rsquo;s On</a>
            <Link href="/list" className={styles.quiet}>List a Conference <span aria-hidden="true">&rarr;</span></Link>
          </div>
          <p className={styles.start}>New to MUN? <Link href="/start" className="link">Start here</Link></p>
        </Reveal>
        <div className={styles.heroPic}>
          {/* Sized for the column it sits in, in the smallest format each browser can show; loaded first, with its
              space held by the frame's aspect ratio so nothing moves when it arrives. */}
          <picture className={styles.heroImg}>
            <source type="image/avif" srcSet={HERO("avif")} sizes={HERO_SIZES} />
            <source type="image/webp" srcSet={HERO("webp")} sizes={HERO_SIZES} />
            <img src="/img/general-assembly-960.jpg" srcSet={HERO("jpg")} sizes={HERO_SIZES} width={1440} height={960}
              alt="The United Nations General Assembly Hall in New York" fetchPriority="high" decoding="async" />
          </picture>
          <NextCard />
        </div>
        <a href="#upcoming" className={styles.scrollCue}>
          Upcoming
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
      </section>

      {/* Below the hero, three calm sections one after another: what's on, a date check, and listing yours. */}
      <section id="upcoming" className={`container ${styles.board}`} aria-labelledby="upcoming-h">
        <div className={styles.boardHead}>
          <h2 id="upcoming-h" className={`serif ${styles.h2}`}>Upcoming</h2>
          <Link href="/calendar" className="link">Open calendar →</Link>
        </div>
        <UpcomingBoard />
      </section>

      <section className={`container ${styles.section}`} aria-labelledby="check-h">
        <MiniCalendar />
      </section>

      <section className={`container ${styles.section}`} aria-labelledby="list-h">
        <div className="callout">
          <h2 id="list-h" className="calloutTitle">Running a conference?</h2>
          <div className="calloutActions">
            <Link href="/list" className="button">List It Free</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
