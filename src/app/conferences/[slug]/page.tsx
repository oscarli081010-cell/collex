import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import { allPages, formatDate, formatRange, getConference, NA } from "@/lib/conferences";
import s from "../../inner.module.css";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return allPages.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = getConference((await params).slug);
  return { title: c ? `${c.isTemplate ? "The standard page" : c.name} · Collex` : "Collex" };
}

const SECTIONS = [
  ["overview", "Overview"],
  ["dates", "Key dates"],
  ["committees", "Committees"],
  ["guides", "Background guides"],
  ["secretariat", "Secretariat"],
  ["registration", "Fees and registration"],
  ["venue", "Venue"],
  ["apply", "Apply"],
] as const;

export default async function ConferencePage({ params }: Props) {
  const c = getConference((await params).slug);
  if (!c) notFound();

  return (
    <main id="top">
      {c.isTemplate && (
        <p className={s.notice}>
          This is the standard page every conference gets. Nothing is listed yet, so every field shows N/A.
        </p>
      )}
      <TopBar />
      <header className={s.head} data-reveal>
        <h1 className={`display ${s.title}`}>{c.name}</h1>
        <p className={s.lead}>Host school: {c.host}<br />Dates: {formatRange(c)}</p>
      </header>

      <div className={s.body}>
        <dl className={s.facts} data-reveal>
          {[
            ["Dates", formatRange(c)],
            ["Host", c.host],
            ["Venue", c.venue],
            ["Level", c.level ?? NA],
            ["Format", c.format ?? NA],
            ["Delegates", c.delegates],
          ].map(([k, v]) => (
            <div key={k} className={s.fact}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>

        <div className={s.confGrid}>
          <nav className={s.side} aria-label="On this page">
            {SECTIONS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </nav>

          <div className={s.main}>
            <section id="overview" className={s.block} data-reveal>
              <h2 className={s.h2}>Overview</h2>
              <p>{c.overview}</p>
            </section>

            <section id="dates" className={s.block} data-reveal>
              <h2 className={s.h2}>Key dates</h2>
              <table className={s.table}>
                <thead><tr><th scope="col">What</th><th scope="col" style={{ textAlign: "right" }}>When</th></tr></thead>
                <tbody>
                  {c.keyDates.map((k) => (
                    <tr key={k.label}><td>{k.label}</td><td>{formatDate(k.date)}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section id="committees" className={s.block} data-reveal>
              <h2 className={s.h2}>Committees</h2>
              <table className={s.table}>
                <thead><tr><th scope="col">Committee</th><th scope="col">Topic</th><th scope="col">Level</th><th scope="col" style={{ textAlign: "right" }}>Chairs</th></tr></thead>
                <tbody>
                  {c.committees.map((x, i) => (
                    <tr key={i}><td>{x.name}</td><td>{x.topic}</td><td>{x.level}</td><td>{x.chairs}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section id="guides" className={s.block} data-reveal>
              <h2 className={s.h2}>Background guides</h2>
              <table className={s.table}>
                <thead><tr><th scope="col">Committee</th><th scope="col">Released</th><th scope="col" style={{ textAlign: "right" }}>Guide</th></tr></thead>
                <tbody>
                  {c.guides.map((g, i) => (
                    <tr key={i}>
                      <td>{g.committee}</td>
                      <td>{formatDate(g.released)}</td>
                      <td>{g.url ? <a className="link" href={g.url}>Download</a> : <span className="muted">Not released</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section id="secretariat" className={s.block} data-reveal>
              <h2 className={s.h2}>Secretariat</h2>
              <div className={s.pairs}>
                {c.secretariat.map((p) => (
                  <p key={p.role} className={s.pair}><span>{p.role}</span>{p.name}</p>
                ))}
              </div>
            </section>

            <section id="registration" className={s.block} data-reveal>
              <h2 className={s.h2}>Fees and registration</h2>
              <div className={s.pairs}>
                <p className={s.pair}><span>Delegate fee</span>{c.fee}</p>
                <p className={s.pair}><span>Registration</span>Through the host school&rsquo;s MUN coordinator</p>
                <p className={s.pair}><span>Contact</span>{c.contact}</p>
                <p className={s.pair}><span>Website</span>{c.website}</p>
              </div>
            </section>

            <section id="venue" className={s.block} data-reveal>
              <h2 className={s.h2}>Venue</h2>
              <div className={s.pairs}>
                <p className={s.pair}><span>Venue</span>{c.venue}</p>
                <p className={s.pair}><span>Suburb</span>{c.suburb}</p>
              </div>
            </section>

            <section id="apply" className={s.block} data-reveal>
              <h2 className={s.h2}>Apply</h2>
              <div className={s.apply}>
                <div className={s.applyCard}>
                  <h3>Register a delegation</h3>
                  <p>Schools register once and get their country allocations by email.</p>
                  <button className="button" disabled>Opens soon</button>
                </div>
                <div className={s.applyCard}>
                  <h3>Apply to chair</h3>
                  <p>One application, read by the secretariat, with the outcome sent by email.</p>
                  <button className="button" disabled>Opens soon</button>
                </div>
              </div>
              <p className="muted" style={{ marginTop: 20 }}>
                Running this conference? <Link className="link" href="/list" style={{ color: "var(--ink)" }}>List it on Collex</Link>.
              </p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
