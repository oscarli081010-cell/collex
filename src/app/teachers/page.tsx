import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT } from "@/components/Footer";
import PageBand from "@/components/PageBand";
import s from "@/components/LegalPage.module.css";
import x from "@/components/InfoPages.module.css";

export const metadata: Metadata = {
  alternates: { canonical: "/teachers" },
  title: "For teachers and parents · Collex",
  description: "Who runs Collex, how listings are checked, what it collects about students and who sees it, and a checklist before approving a conference.",
};

const CHECKS = [
  "The conference has its own page on Collex, with a host school and a contact email you can write to.",
  "The dates, start and finish times and venue suit the student, and don’t clash with exams or school events.",
  "You know what it costs and how the fee is paid. The fee is on the conference’s page, or ask its contact.",
  "You know the dress code, whether devices are allowed, and whether lunch is provided.",
  "You know who supervises students on the day. Ask the organisers if it isn’t stated.",
  "The student has their committee, country and background guide, and knows when position papers are due.",
  "Your school’s permission form is signed. Each conference page has a one-page sheet to print with its details.",
];

export default function Teachers() {
  const mail = <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;
  return (
    <main id="top" className="container">
      <PageBand title="For teachers" accent="and parents" lead="Who runs Collex, what it collects about students, and what a conference day involves." />
      <div className={`${s.page} ${s.afterBand}`}>
        <nav className={s.side} aria-label="For teachers and parents">
          <ul>
            <li><a href="#who">Who runs Collex</a></li>
            <li><a href="#checked">How listings are checked</a></li>
            <li><a href="#data">Student information</a></li>
            <li><a href="#remove">Removing information</a></li>
            <li><a href="#day">A conference day</a></li>
            <li><a href="#checklist">Before you say yes</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
          <p className={s.contact}>Questions <a href={`mailto:${CONTACT}`} className="link">{CONTACT}</a></p>
        </nav>
        <article className={s.body}>
          <section id="who">
            <h2>Who runs Collex</h2>
            <p>Collex is a calendar of Model United Nations conferences in Sydney, with a page for each one. It is run by Oscar Li, from Sydney, New South Wales, and it is free for every conference and every delegate.</p>
            <p>Collex is independent. It is not affiliated with, endorsed by or connected to the United Nations, or to any school, university or conference listed on it. Each conference is run by its own organisers, usually a host school&rsquo;s students and staff. Collex does not run conferences or take payments.</p>
          </section>

          <section id="checked">
            <h2>How listings are checked</h2>
            <ul>
              <li>Anyone with an account can send a conference. It goes to the Collex team first, not straight onto the site.</li>
              <li>A person reads each one before it goes live, looking at the host school, the dates and where the links go.</li>
              <li>A <strong>Verified</strong> badge means the listing was sent by the conference&rsquo;s own secretariat, and the Collex team has confirmed that.</li>
              <li>Listings without the badge are still reviewed, but may have been sent by someone else involved. Check anything important with the conference&rsquo;s contact.</li>
            </ul>
            <p>More detail is on the <Link href="/about">About page</Link>.</p>
          </section>

          <section id="data">
            <h2>What Collex collects about students</h2>
            <p>Students can read every conference page without an account. An account is needed to follow a conference, apply, or use most of the tools.</p>
            <ul>
              <li><strong>An account</strong> holds a name, an email address and a password, which nobody at Collex can read. The school and a profile photo are optional.</li>
              <li><strong>Following or showing interest</strong> in a conference: the organisers see only how many people did, never who. They can email followers through Collex without seeing who they are.</li>
              <li><strong>Applying to a conference on Collex</strong>: that conference&rsquo;s organisers see what the student entered (name, school, year, choices, experience and any note), so they can allocate committees and countries. They don&rsquo;t see the student&rsquo;s account email, and helpers with view-only access see less. Other conferences don&rsquo;t see it. Twelve months after the conference ends, everything except the name, status, committee and country is blanked.</li>
              <li><strong>In a committee</strong> that lets delegates use their own devices, the chairs can read every note passed, including notes between delegates, and see how each country voted. Chairs&rsquo; marks are private to the chairs unless they release them, and then each student sees only the mark for their own country.</li>
              <li><strong>A student&rsquo;s record</strong> of conferences that accepted them is private unless the student switches it on. If they do, it shows their name, school, and those conferences with their committee and country.</li>
              <li><strong>Emails</strong>: students are emailed about their own account and applications, and when they are added to a committee as a chair. Updates and reminders about conferences they follow, organisers&rsquo; emails and the weekly email (off unless they turn it on) each have an unsubscribe link that works in one click without logging in.</li>
              <li>Collex uses no advertising or tracking, and does not sell information.</li>
            </ul>
            <p>Students under 18 are asked to check with a parent or guardian before creating an account. The <Link href="/privacy">privacy policy</Link> has the full detail, including where information is stored and which providers handle it. If the two ever differ, the privacy policy is right.</p>
          </section>

          <section id="remove">
            <h2>Removing information</h2>
            <p>A student can delete their account themselves from their account page. That removes their account, applications, registrations and follows straight away. To have anything else removed or corrected, email {mail}. A parent, guardian or teacher can also email to ask us to correct or delete a student&rsquo;s information; we may need to check who is asking first. The <Link href="/privacy">privacy policy</Link> explains what is kept and for how long.</p>
          </section>

          <section id="day">
            <h2>What a conference day involves</h2>
            <p>Most Sydney school conferences run for one day at a host school, roughly within school hours. Some run over two or three days. The schedule on each conference&rsquo;s page has the times when the organisers have added them.</p>
            <ul>
              <li>Students check in, then attend an opening ceremony.</li>
              <li>Each student sits in a committee of students from several schools, chaired by older students. They represent a country, give short speeches and negotiate a resolution.</li>
              <li>There is a lunch break, and the day ends with a vote and a closing ceremony.</li>
            </ul>
            <p>Supervision, food and fees are set by each conference. Ask its organisers, using the contact on its page.</p>
          </section>

          <section id="checklist">
            <h2>Before you say yes</h2>
            <p>A short list to go through before approving a student&rsquo;s attendance. The boxes are only for you: nothing is saved.</p>
            <div className={x.checklist}>
              {CHECKS.map((c) => (
                <label key={c} className="check"><input type="checkbox" /><span>{c}</span></label>
              ))}
            </div>
          </section>

          <section id="contact">
            <h2>Contact</h2>
            <p>For questions about Collex, email {mail}. For questions about a conference, such as supervision or fees, email the contact on that conference&rsquo;s page.</p>
          </section>
        </article>
      </div>
    </main>
  );
}
