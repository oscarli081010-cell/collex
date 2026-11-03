import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT } from "@/components/Footer";
import s from "@/components/LegalPage.module.css";

export const metadata: Metadata = {
  title: "About · Collex",
  description: "Why Collex exists, who it's for, and how listings work.",
};

export default function About() {
  return (
    <main id="top" className={`container ${s.page}`}>
      <nav className={s.side} aria-label="About">
        <ul>
          <li><a href="#why" aria-current="page">About Collex</a></li>
          <li><Link href="/list">List a conference</Link></li>
          <li><Link href="/privacy">Privacy policy</Link></li>
        </ul>
        <p className={s.contact}>Say hello <a href={`mailto:${CONTACT}`} className="link">{CONTACT}</a></p>
      </nav>
      <article className={s.body}>
        <header className={s.head}>
          <h1 className={`serif ${s.title}`}>One calendar for the Sydney circuit.</h1>
          <p className={s.lead}>Collex puts the Model United Nations conferences in Sydney on one calendar, each with its own clear page: dates, host, committees and the links to apply.</p>
        </header>

        <section id="why">
          <h2>Why it exists</h2>
          <p>Conference details are often spread across school websites, social posts and group chats, which makes deadlines easy to miss and dates easy to clash. Collex gathers them in one place, in the same format, so the season can be seen at a glance.</p>
        </section>

        <section>
          <h2>How listings work</h2>
          <ul>
            <li>Organisers list their own conference for free.</li>
            <li>The Collex team reviews each listing before it goes live.</li>
            <li>Listings marked <strong>Verified</strong> were sent by the conference&rsquo;s own secretariat.</li>
            <li>Organisers can update their listing any time, and people following it get an email when applications open or guides are released.</li>
          </ul>
        </section>

        <section>
          <h2>Independent</h2>
          <p>Collex is independent. It is not affiliated with, endorsed by or connected to the United Nations, or to any school, university or conference listed on it.</p>
        </section>

        <section>
          <h2>Who runs it</h2>
          {/* TODO(Oscar): add the operator's name here, e.g. "Collex is run by …". */}
          {/* TODO(Oscar): add the ABN here if Collex has one. Do not publish either until confirmed. */}
          <p>Collex is run from Sydney, New South Wales, Australia. For questions, corrections or to get involved, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
        </section>
      </article>
    </main>
  );
}
