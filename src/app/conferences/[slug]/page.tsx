import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatRange, NA, template, type Conference } from "@/lib/conferences";
import { getBySlug, getPublished } from "@/lib/data";
import ApplyBand from "@/components/ApplyBand";
import ConferenceActions from "@/components/ConferenceActions";
import ConferenceTabs from "@/components/ConferenceTabs";
import Countdown from "@/components/Countdown";
import FollowButton from "@/components/FollowButton";
import Verified from "@/components/Verified";
import s from "../../inner.module.css";

type Props = { params: Promise<{ slug: string }> };

const icon = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const ICONS = {
  date: icon(<><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></>),
  host: icon(<><path d="M2 13.5h12M3.5 13.5V7L8 3.5 12.5 7v6.5" /><path d="M6.5 13.5v-3h3v3" /></>),
  venue: icon(<><path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 00-9 0C3.5 9.8 8 14 8 14z" /><circle cx="8" cy="6.5" r="1.6" /></>),
};

export const revalidate = 60;

export async function generateStaticParams() {
  return [template, ...(await getPublished())].map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getBySlug((await params).slug);
  if (!c) return { title: "Collex" };
  if (c.isTemplate) return { title: "Demo · Collex", robots: { index: false } };
  return {
    title: `${c.name} · Collex`,
    description: describe(c),
    alternates: { canonical: `/conferences/${c.slug}` },
    openGraph: { title: c.name, description: describe(c), siteName: "Collex", locale: "en_AU", type: "website", url: `/conferences/${c.slug}` },
  };
}

// One or two plain sentences for search results: the overview if there is one, otherwise the facts.
function describe(c: Conference) {
  const when = c.startDate ? `, ${formatRange(c)}` : "";
  const facts = `${c.name}, a Model UN conference hosted by ${c.host}${when}.`;
  if (c.overview === NA) return facts;
  return c.overview.length > 160 ? `${c.overview.slice(0, 157).trimEnd()}…` : c.overview;
}

// schema.org Event data, so search engines can show the conference as an event. Only facts from the listing.
function eventSchema(c: Conference) {
  const place = c.venue === NA ? c.host : c.venue;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: c.name,
    startDate: c.startDate,
    ...(c.endDate && { endDate: c.endDate }),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: place,
      address: { "@type": "PostalAddress", addressLocality: "Sydney", addressRegion: "NSW", addressCountry: "AU" },
    },
    organizer: { "@type": "Organization", name: c.host },
    ...(c.overview !== NA && { description: c.overview }),
    url: `https://collex.au/conferences/${c.slug}`,
  };
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
        {!c.isTemplate && c.startDate && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema(c)).replace(/</g, "\\u003c") }} />
        )}
        <section className={s.confFirst}>
        <div className={s.cover}>
          {c.cover
            // eslint-disable-next-line @next/next/no-img-element -- organisers' photos come straight from storage at their own size
            ? <img src={c.cover} alt="" className={s.coverImg} fetchPriority="high" />
            : <span>{c.isTemplate ? "Cover image N/A" : c.shortName}</span>}
        </div>

        <header className={s.confHead}>
          <div>
            {c.isTemplate ? <span className="badge accent">Demo listing</span> : (
              <span className={s.confBadges}>{c.verified && <Verified />}<Countdown c={c} /></span>
            )}
            <h1 className={s.confTitle}>{c.name}</h1>
            <ul className={s.confMeta}>
              <li>{ICONS.date}{formatRange(c)}</li>
              <li>{ICONS.host}Hosted by {c.host}</li>
              <li>{ICONS.venue}{c.venue}</li>
            </ul>
          </div>
          <div className={s.confAside}>
            <ConferenceActions c={c} />
            {c.id && <FollowButton id={c.id} name={c.name} />}
          </div>
        </header>

        <ApplyBand c={c} />
        <a href="#details" className={s.cue}>
          Details
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
        </section>

        <div id="details" className={s.details}>
        <ConferenceTabs tabs={TABS} />

        <div className={s.confGrid}>
          <div className={s.main}>
            <section id="overview" className={s.block}>
              <h2 className={s.h2}>Overview</h2>
              <p>{c.overview}</p>
              {c.updatedAt && <p className={s.updated}>Updated {new Date(c.updatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" })}</p>}
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
        </div>
      </main>
  );
}
