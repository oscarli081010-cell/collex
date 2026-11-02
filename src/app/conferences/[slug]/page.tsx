import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allPages, formatDate, formatRange, getConference, NA } from "@/lib/conferences";
import ApplyBand from "@/components/ApplyBand";
import ConferenceActions from "@/components/ConferenceActions";
import ConferenceTabs from "@/components/ConferenceTabs";
import s from "../../inner.module.css";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return allPages.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = getConference((await params).slug);
  return { title: c ? `${c.isTemplate ? "The standard page" : c.name} · Collex` : "Collex" };
}

const TABS = [
  ["overview", "Overview"],
  ["dates", "Key dates"],
  ["committees", "Committees"],
  ["guides", "Background guides"],
  ["secretariat", "Secretariat"],
] as const;

const initials = (name: string) => (name === NA ? "" : name.split(" ").map((w) => w[0]).join("").slice(0, 2));

export default async function ConferencePage({ params }: Props) {
  const c = getConference((await params).slug);
  if (!c) notFound();

  return (
      <main id="top" className="container">
        <div className={s.cover}>
          <span>{c.isTemplate ? "Cover image N/A" : c.shortName}</span>
        </div>

        <header className={s.confHead}>
          <div>
            {c.isTemplate && <span className="badge accent">Example listing · details show as N/A</span>}
            <h1 className={s.confTitle}>{c.name}</h1>
            <p className={s.confSub}>{formatRange(c)} · Hosted by {c.host} · {c.venue}</p>
          </div>
          <ConferenceActions c={c} />
        </header>

        <ApplyBand c={c} />

        <ConferenceTabs tabs={TABS} />

        <div className={s.confGrid}>
          <div className={s.main}>
            <section id="overview" className={s.block}>
              <h2 className={s.h2}>Overview</h2>
              <p>{c.overview}</p>
            </section>

            <section id="dates" className={s.block}>
              <h2 className={s.h2}>Key dates</h2>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead><tr><th scope="col">What</th><th scope="col" className={s.right}>When</th></tr></thead>
                  <tbody>
                    {c.keyDates.map((k) => (
                      <tr key={k.label}><td>{k.label}</td><td className={s.right}>{formatDate(k.date)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="committees" className={s.block}>
              <h2 className={s.h2}>Committees</h2>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead><tr><th scope="col">Committee</th><th scope="col">Topic</th><th scope="col">Level</th><th scope="col" className={s.right}>Chairs</th></tr></thead>
                  <tbody>
                    {c.committees.map((x, i) => (
                      <tr key={i}><td>{x.name}</td><td>{x.topic}</td><td>{x.level}</td><td className={s.right}>{x.chairs}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="guides" className={s.block}>
              <h2 className={s.h2}>Background guides</h2>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead><tr><th scope="col">Committee</th><th scope="col">Released</th><th scope="col" className={s.right}>File</th></tr></thead>
                  <tbody>
                    {c.guides.map((g, i) => (
                      <tr key={i}>
                        <td>{g.committee}</td>
                        <td>{formatDate(g.released)}</td>
                        <td className={s.right}>{g.url ? <a className="link" href={g.url}>Download</a> : <span className="muted">Not released</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="secretariat" className={s.block}>
              <h2 className={s.h2}>Secretariat</h2>
              <div className={s.people}>
                {c.secretariat.map((p) => (
                  <div key={p.role} className={`panel ${s.person}`}>
                    <span className={s.avatar} aria-hidden="true">{initials(p.name)}</span>
                    <span>{p.name}<small>{p.role}</small></span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className={`panel ${s.facts}`} aria-label="At a glance">
            <dl>
              {[
                ["Dates", formatRange(c)],
                ["Host school", c.host],
                ["Venue", c.venue],
                ["Suburb", c.suburb],
                ["Level", c.level ?? NA],
                ["Format", c.format ?? NA],
                ["Delegates", c.delegates],
                ["Delegate fee", c.fee],
                ["Contact", c.contact],
                ["Website", c.website],
              ].map(([k, v]) => (
                <div key={k} className={s.fact}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            <p className="muted" style={{ fontSize: 13, padding: "12px 0 14px", borderTop: "1px solid var(--line)" }}>
              Run this conference? <Link className="link" href="/list">Update the listing</Link>
            </p>
          </aside>
        </div>
      </main>
  );
}
