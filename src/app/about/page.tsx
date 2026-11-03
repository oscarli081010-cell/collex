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
          <li><a href="#who">Who runs it</a></li>
          <li><a href="#reviews">How listings are reviewed</a></li>
          <li><a href="#verified">What Verified means</a></li>
          <li><a href="#contact">Contact</a></li>
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

        <section id="who">
          <h2>Who runs it</h2>
          <p>Collex is run by Oscar Li, from Sydney, New South Wales. It is free for every conference and every delegate.</p>
          {/* TODO(Oscar): add the ABN here once confirmed, e.g. "ABN 00 000 000 000". Do not publish a number until it's real. */}
        </section>

        <section id="reviews">
          <h2>How listings are reviewed</h2>
          <ul>
            <li>Anyone with an account can list a conference for free. It goes to the Collex team first, not straight onto the site.</li>
            <li>A person on the Collex team reads each one before it goes live, looking at the host school, the dates and where the links go.</li>
            <li>Once approved, the listing gets its own page and joins the calendar. If it can&rsquo;t be approved, the person who sent it sees why on their account page.</li>
            <li>Organisers, and the co-organisers they invite, can update a listing any time. Each change is recorded, and people following it get an email when applications open or guides are released.</li>
          </ul>
        </section>

        <section id="verified">
          <h2>What Verified means</h2>
          <p>A <strong>Verified</strong> badge means the listing was sent by the conference&rsquo;s own secretariat, and the Collex team has confirmed that before adding the badge.</p>
          <p>Listings without the badge are still reviewed before they go live. They may have been sent by someone else involved, such as a delegate or teacher, so check the details with the conference if something matters.</p>
        </section>

        <section>
          <h2>Independent</h2>
          <p>Collex is independent. It is not affiliated with, endorsed by or connected to the United Nations, or to any school, university or conference listed on it.</p>
        </section>

        <section id="contact">
          <h2>Contact</h2>
          <p>For questions, corrections or to get involved, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. To fix a mistake on a listing, say which conference and what should change.</p>
        </section>
      </article>
    </main>
  );
}
