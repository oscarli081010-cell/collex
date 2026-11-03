import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { formatDate, formatRange, isPast, NA, template, type Conference } from "@/lib/conferences";
import { getBySlug, getPublished } from "@/lib/data";
import ApplyBand from "@/components/ApplyBand";
import ConferenceActions from "@/components/ConferenceActions";
import ConferenceTabs from "@/components/ConferenceTabs";
import Countdown from "@/components/Countdown";
import FollowButton from "@/components/FollowButton";
import OrganiserPanel from "@/components/OrganiserPanel";
import Verified from "@/components/Verified";
import { META_ICONS as ICONS } from "@/components/MetaIcons";
import s from "../../inner.module.css";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 60;

export async function generateStaticParams() {
  return [template, ...(await getPublished())].map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getBySlug((await params).slug);
  if (!c) return { title: "Collex" };
  if (c.isTemplate) return { title: "Demo · Collex", robots: { index: false } };
  // Shared links show the organiser's cover photo when there is one, otherwise the generated card.
  const image = c.cover
    ? { url: c.cover, alt: `${c.name} cover photo` }
    : { url: `/conferences/${c.slug}/share.png`, width: 1200, height: 630, alt: `${c.name} on Collex` };
  return {
    title: `${c.name} · Collex`,
    description: describe(c),
    alternates: { canonical: `/conferences/${c.slug}` },
    openGraph: { title: c.name, description: shareLine(c), siteName: "Collex", locale: "en_AU", type: "website", url: `/conferences/${c.slug}`, images: [image] },
    twitter: { card: "summary_large_image", title: c.name, description: shareLine(c), images: [image] },
  };
}

// The line under a shared link's title: when and where.
function shareLine(c: Conference) {
  const when = c.startDate ? formatRange(c) : "Dates to be announced";
  const where = c.venue === NA ? `hosted by ${c.host}` : `at ${c.venue}, hosted by ${c.host}`;
  return `${when}, ${where}.`;
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
  const past = isPast(c);

  return (
      <main id="top" className="container">
        {!c.isTemplate && c.startDate && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema(c)).replace(/</g, "\\u003c") }} />
        )}
        <section className={s.confFirst}>
        <ViewTransition name={`cover-${c.slug}`} share="morph" default="none">
          <div className={s.cover}>
            {c.cover
              // eslint-disable-next-line @next/next/no-img-element -- organisers' photos come straight from storage at their own size
              ? <img src={c.cover} alt="" className={s.coverImg} fetchPriority="high" />
              : <span>{c.isTemplate ? "Cover image N/A" : c.shortName}</span>}
          </div>
        </ViewTransition>

        <header className={s.confHead}>
          <div>
            {c.isTemplate ? <span className="badge accent">Demo listing</span> : (
              <span className={s.confBadges}>{past && <span className="badge">Finished</span>}{c.verified && <Verified />}<Countdown c={c} /></span>
            )}
            <ViewTransition name={`title-${c.slug}`} share="morph" default="none">
              <h1 className={s.confTitle}>{c.name}</h1>
            </ViewTransition>
            <ul className={s.confMeta}>
              <li>{ICONS.date}{formatRange(c)}</li>
              <li>{ICONS.host}Hosted by {c.host}</li>
              <li>{ICONS.venue}{c.venue}</li>
            </ul>
          </div>
          <div className={s.confAside}>
            <ConferenceActions c={c} past={past} />
            {c.id && !past && <FollowButton id={c.id} name={c.name} />}
          </div>
        </header>

        {past ? (
          <section className={s.finished} aria-label="Finished">
            <h2 className={s.finishedTitle}>This conference has finished</h2>
            <p className="muted">Its page stays up so committees and guides are easy to look back on. <Link href="/conferences" className="link">See what&rsquo;s coming up</Link></p>
          </section>
        ) : <ApplyBand c={c} />}
        <a href="#details" className={s.cue}>
          Details
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
        </section>

        <div id="details" className={s.details}>
        <ConferenceTabs tabs={TABS} />

        <div className={s.confGrid}>
          <div className={s.main}>
            {!past && <OrganiserPanel c={c} />}
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
