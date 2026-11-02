import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatRange, NA, template } from "@/lib/conferences";
import { getBySlug, getPublished } from "@/lib/data";
import ApplyBand from "@/components/ApplyBand";
import ConferenceActions from "@/components/ConferenceActions";
import ConferenceTabs from "@/components/ConferenceTabs";
import s from "../../inner.module.css";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 60;

export async function generateStaticParams() {
  return [template, ...(await getPublished())].map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getBySlug((await params).slug);
  return { title: c ? `${c.isTemplate ? "Demo" : c.name} · Collex` : "Collex" };
}

const TABS = [
  ["overview", "Overview"],
  ["dates", "Key dates"],
  ["committees", "Committees"],
  ["guides", "Background guides"],
  ["secretariat", "Secretariat"],
] as const;

function Nothing({ what }: { what: string }) {
  return (
    <div className={s.nothing}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect x="5" y="4" width="18" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M9.5 10h9M9.5 14h9M9.5 18h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      <p>There&rsquo;s nothing to show yet.</p>
      <span>The {what} will appear here once they&rsquo;re announced.</span>
    </div>
  );
}

const initials = (name: string) => (name === NA ? "" : name.split(" ").map((w) => w[0]).join("").slice(0, 2));

export default async function ConferencePage({ params }: Props) {
  const c = await getBySlug((await params).slug);
  if (!c) notFound();

  return (
      <main id="top" className="container">
        <div className={s.cover}>
          <span>{c.isTemplate ? "Cover image N/A" : c.shortName}</span>
        </div>

        <header className={s.confHead}>
          <div>
            {c.isTemplate && <span className="badge accent">Demo listing</span>}
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
              {c.committees.length === 0 ? (
                <Nothing what="committees" />
              ) : (
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
              )}
            </section>

            <section id="guides" className={s.block}>
              <h2 className={s.h2}>Background guides</h2>
              {c.guides.length === 0 ? (
                <Nothing what="background guides" />
              ) : (
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
              )}
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
                ["Level", c.level ?? NA],
                ["Delegates", c.delegates],
                ["Delegate fee", c.fee],
                ["Contact", c.contact],
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
