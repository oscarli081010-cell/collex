import type { Metadata } from "next";
import Link from "next/link";
import PageBand from "@/components/PageBand";
import s from "@/components/LegalPage.module.css";
import x from "@/components/InfoPages.module.css";

export const metadata: Metadata = {
  alternates: { canonical: "/start" },
  title: "Start here · Collex",
  description: "New to Model UN? What it is, what a first conference day looks like, how to choose one in Sydney, and what to do the week before.",
};

const STEPS = [
  { title: "You represent a country", text: "Not yourself. You argue for what that country would want, even when you personally disagree." },
  { title: "You debate a real issue", text: "Each committee has a topic the real UN works on, such as clean water or refugees. You give speeches and negotiate." },
  { title: "You write and vote on a resolution", text: "Countries that agree write a resolution together: what should be done, and by whom. Then the committee votes." },
];

export default function Start() {
  return (
    <main id="top" className="container">
      <PageBand title="Start" accent="here" lead="New to Model UN. What it is, what the day looks like, and how to choose your first conference." />
      <div className={`${s.page} ${s.afterBand}`}>
        <nav className={s.side} aria-label="Start here">
          <ul>
            <li><a href="#what">What Model UN is</a></li>
            <li><a href="#day">A conference day</a></li>
            <li><a href="#choose">Choosing a conference</a></li>
            <li><a href="#week">The week before</a></li>
            <li><Link href="/teachers">For teachers and parents</Link></li>
          </ul>
        </nav>
        <article className={s.body}>
          <section id="what">
            <h2>What Model UN is</h2>
            <p>Model United Nations (MUN) is a debating and negotiating event for school students. It works in three steps.</p>
            <div className={x.steps} role="list">
              {STEPS.map((t, i) => (
                <div key={t.title} role="listitem" className={`panel ${x.step}`}>
                  <span className={x.stepNum} aria-hidden="true">Step {i + 1}</span>
                  <span className={x.stepTitle}>{t.title}</span>
                  <span className={x.stepText}>{t.text}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="day">
            <h2>A first conference day</h2>
            <p>Most Sydney school conferences run for one day. Some run over two or three. Times differ, so check the schedule on the conference&rsquo;s page.</p>
            <ol>
              <li>Arrive, check in and find your committee room.</li>
              <li>The opening ceremony, usually in a hall with every delegate.</li>
              <li>Committee: the chair takes the roll call, then countries give short opening speeches.</li>
              <li>Debate and caucuses. Delegates negotiate, find countries that agree with them and write clauses together.</li>
              <li>Lunch, then more debate and amendments.</li>
              <li>The committee votes on the resolution, and the day ends with a closing ceremony.</li>
            </ol>
          </section>

          <section id="choose">
            <h2>Choosing your first conference</h2>
            <ul>
              <li>Ask your school first. Many schools register a delegation together, with a teacher in charge.</li>
              <li>A one-day conference near home is the easiest start.</li>
              <li>Some conferences mark committees as suitable for beginners. Look at the committee list on each conference&rsquo;s page.</li>
              <li>Check that registration is open and that the date doesn&rsquo;t clash with exams or another conference.</li>
            </ul>
            <p><Link href="/compare">Compare upcoming conferences</Link> side by side, or <Link href="/conferences">see them all</Link> with their dates and links.</p>
          </section>

          <section id="week">
            <h2>The week before</h2>
            <ol>
              <li>Read your committee&rsquo;s background guide. It is on the conference&rsquo;s page once it is released.</li>
              <li>Research your country with <Link href="/guides/position-paper">Research your country and write a position paper</Link>.</li>
              <li>Write a 60-second opening speech with <Link href="/guides/public-speaking">Public speaking and your first speech</Link>, then time it on the <Link href="/practice">Practise page</Link>.</li>
              <li>Read <Link href="/guides/your-first-conference">Your first MUN conference</Link> and keep the <Link href="/guides/mun-glossary">MUN glossary</Link> open.</li>
              <li>Pack using <Link href="/guides/what-to-wear-bring-cost">What to wear, what to bring and what it costs</Link>.</li>
            </ol>
          </section>

          <div className={`panel ${x.next}`}>
            <h2 className={x.nextTitle}>Your next step</h2>
            <p className={x.nextText}>Find a conference that suits you, then ask your teacher about going.</p>
            <Link href="/compare" className="button block">Compare Conferences</Link>
          </div>
        </article>
      </div>
    </main>
  );
}
