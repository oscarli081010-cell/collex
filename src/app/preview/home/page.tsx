import type { Metadata } from "next";
import Link from "next/link";
import HeroSearch from "@/components/HeroSearch";
import ScrollFx from "@/components/preview/home/ScrollFx";
import Tour from "@/components/preview/home/Tour";
import NextUp from "@/components/preview/home/NextUp";
import { Laptop, Phone, Screen, Shot } from "@/components/preview/home/Devices";
import s from "./home.module.css";

// A second home page, kept apart from the real one so the two can be compared. Not linked, not in the sitemap, not indexed.
export const metadata: Metadata = {
  title: "Home preview · Collex",
  robots: { index: false, follow: false },
};

// Words that light up one line at a time as they pass the middle of the window.
const STATEMENT = "Dates, committees and the links to apply for every conference, in the same clear format. No more hunting through school websites and group chats.";

const TOOLS: { title: string; text: string; art: React.ReactNode; wide?: boolean }[] = [
  { title: "The speakers’ list", text: "Add states as placards go up. One key calls the next speaker, and the timer runs on the display.", art: <span className={s.key}>N</span>, wide: true },
  { title: "Motions and votes", text: "Put a motion to the vote, count placards or take a roll call, and record the result.", art: <Icon d="M4 12l5 5L20 6" /> },
  { title: "Marks out of 10", text: "Speaking, diplomacy, knowledge and procedure, seen only by the chairs.", art: <span className={`serif ${s.big}`}>10</span> },
  { title: "Two chairs, one committee", text: "Share a join code and run the console from two laptops at once.", art: <Icon d="M8 11a3 3 0 100-6 3 3 0 000 6zM16 11a3 3 0 100-6 3 3 0 000 6zM2.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M13.8 15c.7-.3 1.4-.5 2.2-.5 2.5 0 4.7 1.5 5.5 4.5" /> },
  { title: "If the wifi drops", text: "The laptop keeps running the committee, and its display keeps up. Changes are sent when it reconnects.", art: <Icon d="M2 9a15 15 0 0120 0M5.5 12.5a10 10 0 0113 0M9 16a5 5 0 016 0M12 19.5h.01" /> },
];

function Icon({ d }: { d: string }) {
  return <svg className={s.icon} width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const ORGANISE = [
  { n: "01", title: "Applications", text: "Take registrations and chair applications on Collex, or link your own form." },
  { n: "02", title: "Allocation", text: "Accept delegates, allocate committees and countries, and email everyone in one go." },
  { n: "03", title: "Check-in", text: "Scan each delegate’s code at the door with a phone." },
  { n: "04", title: "Every room, live", text: "Link each committee to the conference and follow them all from one page." },
];

export default function HomePreview() {
  return (
    <main id="top" className={s.page}>
      <ScrollFx />

      {/* The first screen: the line, the search, and the two devices rising up underneath. */}
      <section className={`container ${s.hero}`}>
        <h1 className={`serif ${s.title}`}>Sydney Model UN, <em>in one place.</em></h1>
        <p className={s.lead}>Every conference on one calendar, a page for each, and free tools to run them.</p>
        <div className={s.heroSearch}><HeroSearch /></div>
        <p className={s.heroLinks}>
          <Link href="/start" className="link">New to MUN?</Link>
          <span aria-hidden="true">·</span>
          <Link href="/list" className="link">List a Conference</Link>
        </p>
      </section>

      <div className={`container ${s.stage}`}>
        <div className={s.stageInner}>
          <Laptop className={s.stageLaptop}>
            <Shot name="laptop-calendar" alt="The Collex calendar, showing April 2027" kind="laptop" sizes="(max-width: 1280px) 86vw, 1100px" />
          </Laptop>
          <Phone className={s.stagePhone}>
            <Shot name="phone-conference" alt="A conference page on Collex, on a phone" kind="phone" sizes="(max-width: 900px) 30vw, 260px" />
          </Phone>
        </div>
      </div>

      <section className={`container ${s.statement}`} aria-label="Why Collex">
        <p className={`serif ${s.statementText}`}>
          {STATEMENT.split(" ").map((w, i) => <span key={i}><span className={s.word}>{w}</span>{" "}</span>)}
        </p>
      </section>

      <section className={`container ${s.section}`} aria-labelledby="find-h">
        <header className={s.head} data-rise>
          <p className={s.kicker}>For delegates and teachers</p>
          <h2 id="find-h" className={`serif ${s.h2}`}>Know what’s on, <em>and when.</em></h2>
        </header>
        <Tour />
      </section>

      <section className={`container ${s.section} ${s.nextSection}`} aria-labelledby="next-h">
        <div className={s.nextHead} data-rise>
          <h2 id="next-h" className={`serif ${s.h2}`}>Coming <em>up.</em></h2>
          <Link href="/calendar" className="link">Open Calendar →</Link>
        </div>
        <NextUp />
      </section>

      {/* Committees: the one dark band, a laptop at the front and the room's display behind it. */}
      <section className={s.pro} aria-labelledby="committees-h">
        <div className={s.proPanel}>
          <div className={`container ${s.proInner}`}>
            <header className={`${s.head} ${s.proHead}`} data-rise>
              <p className={s.kicker}>Committees</p>
              <h2 id="committees-h" className={`serif ${s.h2}`}>Run the room <em>from one laptop.</em></h2>
              <p className={s.proLead}>A free console for chairs, with a display for the projector. Delegates’ devices are optional.</p>
            </header>

            <div className={s.duo}>
              <figure className={s.duoScreen}>
                <Screen>
                  <Shot name="laptop-display" alt="The Committees display: Kenya speaking, 40 seconds left, Japan, Brazil, India and France up next" kind="laptop" sizes="(max-width: 900px) 92vw, 820px" />
                </Screen>
                <figcaption>On the projector</figcaption>
              </figure>
              <figure className={s.duoLaptop}>
                <Laptop>
                  <Shot name="laptop-console" alt="The Committees console: a General Assembly in general debate, with Kenya speaking" kind="laptop" sizes="(max-width: 900px) 80vw, 620px" />
                </Laptop>
                <figcaption>On your laptop</figcaption>
              </figure>
            </div>

            <ul className={s.bento}>
              {TOOLS.map((t) => (
                <li key={t.title} className={`${s.tile} ${t.wide ? s.tileWide : ""}`} data-rise>
                  <div className={s.tileArt}>{t.art}</div>
                  <h3 className={s.tileTitle}>{t.title}</h3>
                  <p className={s.tileText}>{t.text}</p>
                </li>
              ))}
            </ul>

            <div className={s.proActions} data-rise>
              <Link href="/chambers" className={`button lg ${s.proButton}`}>Open Committees</Link>
              <Link href="/guides/chairing-with-committees" className={s.proLink}>Read the Chair’s Guide →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className={`container ${s.section}`} aria-labelledby="run-h">
        <header className={s.head} data-rise>
          <p className={s.kicker}>Your conferences</p>
          <h2 id="run-h" className={`serif ${s.h2}`}>List it free. <em>Run it here.</em></h2>
          <p className={s.headLead}>Once it’s listed, the secretariat runs it from one page.</p>
        </header>
        <ol className={s.organise}>
          {ORGANISE.map((o) => (
            <li key={o.n} className={s.orgItem} data-rise>
              <span className={`serif ${s.orgNum}`}>{o.n}</span>
              <h3 className={s.orgTitle}>{o.title}</h3>
              <p className={s.orgText}>{o.text}</p>
            </li>
          ))}
        </ol>
        <p className={s.orgMore} data-rise><Link href="/list" className="link">List a Conference →</Link></p>
      </section>

      <section className={`container ${s.section} ${s.end}`} aria-labelledby="end-h">
        <div className={`callout ${s.endBand}`} data-rise>
          <h2 id="end-h" className={`serif ${s.endTitle}`}>Find your next <em>conference.</em></h2>
          <div className="calloutActions">
            <Link href="/conferences" className="button">Search Conferences</Link>
            <Link href="/signup" className="button secondary">Create an Account</Link>
          </div>
          <p className={s.endNote}>Free for every conference and every delegate.</p>
        </div>
      </section>
    </main>
  );
}
