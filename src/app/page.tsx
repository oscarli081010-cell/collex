import type { Metadata } from "next";
import Link from "next/link";
import UpcomingBoard from "@/components/UpcomingBoard";
import MiniCalendar from "@/components/MiniCalendar";
import NextCard from "@/components/NextCard";
import HeroSearch from "@/components/HeroSearch";
import SiteNotice from "@/components/SiteNotice";
import { getSiteNotice } from "@/lib/data";
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

// The headline types itself out once as the page arrives: each letter has its own moment (spaces keep theirs, so the
// rhythm reads like typing), and a caret rides along and blinks out at the end. Pure CSS, so the words are in the page
// from the start for search engines; screen readers read the heading's label, not letter by letter.
const STEP = 34;
const TYPE_FROM = 220;
function typed(text: string, from: number, last = false) {
  let i = from;
  const words = text.split(" ");
  return words.map((w, wi) => {
    const chars = [...w].map((ch, ci) => {
      const end = last && wi === words.length - 1 && ci === w.length - 1;
      const el = <span key={ci} className={`${styles.ch} ${end ? styles.chLast : ""}`} style={{ "--d": `${TYPE_FROM + i * STEP}ms` } as React.CSSProperties}>{ch}</span>;
      i++;
      return el;
    });
    i++; // the space
    return <span key={wi}>{w && <span className={styles.word}>{chars}</span>}{wi < words.length - 1 ? " " : null}</span>;
  });
}

export default async function Home() {
  const notice = await getSiteNotice();
  return (
    <main id="top">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([SITE, ORGANIZATION]) }} />
      <section className={`container ${styles.hero}`}>
        <div className={styles.heroText}>
          {notice && <div className={styles.in} style={{ "--at": "60ms" } as React.CSSProperties}><SiteNotice notice={notice} /></div>}
          <h1 className={`serif ${styles.title}`} aria-label="Sydney Model UN, in one place.">
            <span aria-hidden="true">{typed("Sydney Model UN, ", 0)}<em>{typed("in one place.", 17, true)}</em></span>
          </h1>
          <p className={`${styles.lead} ${styles.in}`} style={{ "--at": "1050ms" } as React.CSSProperties}>Upcoming conferences, dates and links, <span className={styles.aura}>on one calendar.</span></p>
          <div className={styles.in} style={{ "--at": "1170ms", width: "100%" } as React.CSSProperties}><HeroSearch /></div>
          <p className={`${styles.start} ${styles.in}`} style={{ "--at": "1290ms" } as React.CSSProperties}>
            <span className={styles.nowrap}>New to MUN? <Link href="/start" className="link">Start here</Link></span>
            <span className={styles.dotSep} aria-hidden="true">·</span>
            <span className={styles.nowrap}>Running one? <Link href="/list" className="link">List it free</Link></span>
          </p>
        </div>
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
